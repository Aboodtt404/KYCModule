"""
KYC OCR Server — Flask, port 5000
Endpoints expected by the React frontend:
  POST /egyptian-id  raw image bytes → {success, extracted_data, face_verification}
  POST /ocr          alias for /egyptian-id
  POST /verify-face  JSON {id_image, live_image, challenge_frames?} base64 → {success, verification_result}
                     challenge_frames: up to 4 frames captured during a head-turn prompt (active liveness)
  GET  /health
"""

from __future__ import annotations

import base64
import datetime
import logging
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Optional

import cv2
import easyocr
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from PIL import Image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ── Verifier (the reconciliation / cross-check layer) ───────────────────────
# Previously this layer was never invoked, so a confident-but-wrong NID read
# could be emitted as if extracted. The verifier turns a read into an
# ACCEPT / ABSTAIN / REJECT verdict: any deterministic contradiction (failed
# checksum, impossible date/gov, an independently-OCR'd field disagreeing, or
# front-NID != back-NID) => REJECT; passing-but-uncorroborated => ABSTAIN (never
# a silent accept). Guarded so a verifier import problem can never break OCR.
try:
    from verifier.verifier import NIDVerifier
    _VERIFIER = NIDVerifier()
    log.info("NIDVerifier active — extraction results carry an ACCEPT/ABSTAIN/REJECT verdict")
except Exception as _verr:  # pragma: no cover - defensive
    _VERIFIER = None
    log.warning("NIDVerifier unavailable (%s) — results will NOT carry a verdict", _verr)

try:
    from verifier.checksum import is_valid_checksum as _nid_checksum_ok
except Exception:  # pragma: no cover - defensive
    _nid_checksum_ok = None

# ── PaddleOCR text-field reader (names/address) — sidecar client ────────────
# Paddle runs in its own process (pp_service.py, :5001): in-process it deadlocks/
# segfaults against TensorFlow+torch (mixed CUDA/OpenMP runtimes). Guarded so a
# sidecar problem can never take down OCR — EasyOCR remains the fallback.
_PP_URL = os.getenv("PP_SERVICE_URL", "http://127.0.0.1:5001")
_PP_READER = False


def _pp_ping() -> bool:
    global _PP_READER
    try:
        import urllib.request
        with urllib.request.urlopen(f"{_PP_URL}/health", timeout=3) as r:
            import json as _json
            _PP_READER = bool(_json.loads(r.read()).get("ok"))
    except Exception:
        _PP_READER = False
    return _PP_READER


def _pp_read_field(bgr_crop, field: str) -> str:
    """Read one field crop via the PP sidecar. Empty string on any failure."""
    try:
        import json as _json
        import urllib.request
        okenc, buf = cv2.imencode(".jpg", bgr_crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not okenc:
            return ""
        payload = _json.dumps({
            "field": field,
            "image": base64.b64encode(buf.tobytes()).decode(),
        }).encode()
        req = urllib.request.Request(
            f"{_PP_URL}/read", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = _json.loads(r.read()).get("text", "") or ""
            log.info("pp read %s: %r", field, text)
            return text
    except Exception as e:
        log.warning("pp sidecar read failed for %s: %s", field, e)
        return ""


def _attach_verification(data: dict, back_nid: Optional[str] = None) -> dict:
    """Attach a deterministic verdict to an extracted-data dict (additive).

    Feeds ONLY independent evidence: the NID's own checksum + structure, the
    back-of-card NID when available (front==back is a fully independent signal),
    and any field the pipeline tagged in `_independent_fields` as read from a
    SEPARATE printed region — never the NID-DERIVED birth_date/gender/gov, which
    would be false corroboration (same source as the number itself).
    """
    if _VERIFIER is None:
        return data
    nid = data.get("national_id") or ""
    indep = data.get("_independent_fields") or {}
    try:
        data["verification"] = _VERIFIER.verify(
            nid, ocr_fields=indep, back_nid=back_nid).to_dict()
    except Exception as _e:  # pragma: no cover - never break the OCR response
        log.warning("verification step failed: %s", _e)
    return data


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # Flask rejects bodies > 20 MB with 413

# Read allowed origins from env; defaults to localhost dev server.
# Production: set ALLOWED_ORIGINS="https://your-frontend-domain.com"
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
CORS(app, resources={"/*": {"origins": _allowed_origins}})

# Rate limiting: persistent across restarts when REDIS_URL is set,
# otherwise falls back to in-memory (resets on restart — acceptable for single-instance dev).
_REDIS_URL = os.getenv("REDIS_URL")  # e.g. redis://localhost:6379
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["60 per hour"],
    storage_uri=_REDIS_URL or "memory://",
)

# ── EasyOCR singleton (Arabic + English) ────────────────────────────────────
_reader = None

def get_reader():
    global _reader
    if _reader is None:
        log.info("Loading EasyOCR (first call — may take ~30 s)…")
        _reader = easyocr.Reader(["ar", "en"], gpu=False)
    return _reader

# ── YOLO model singletons ────────────────────────────────────────────────────
# Four pre-trained models for field-level OCR (more accurate than full-page regex):
#   detect_id_card.pt  — crops just the ID card out of any photo
#   detect_odjects.pt  — locates firstName/lastName/address/nid/serial regions
#   detect_id.pt       — detects each digit of the NID individually, assembled by x-pos
#   segmentation.pt    — ArabID fine-grained segmentation: neighborhood/city/state
_YOLO_AVAILABLE = False
_yolo_card   = None
_yolo_fields = None
_yolo_digits = None
_yolo_seg    = None   # ArabID model — address enrichment + text-based governorate
_yolo_back   = None   # optional back-side field detector (detect_id_back.pt)
_MODEL_DIR   = Path(__file__).parent / "models"

def _load_yolo_models():
    global _YOLO_AVAILABLE, _yolo_card, _yolo_fields, _yolo_digits, _yolo_seg, _yolo_back
    try:
        from ultralytics import YOLO
        card_p   = _MODEL_DIR / "detect_id_card.pt"
        fields_p = _MODEL_DIR / "detect_odjects.pt"
        digits_p = _MODEL_DIR / "detect_id.pt"
        seg_p    = _MODEL_DIR / "segmentation.pt"
        if card_p.exists() and fields_p.exists() and digits_p.exists():
            _yolo_card   = YOLO(str(card_p))
            _yolo_fields = YOLO(str(fields_p))
            _yolo_digits = YOLO(str(digits_p))
            _YOLO_AVAILABLE = True
            log.info("YOLO models loaded — field-level OCR pipeline active")
            if seg_p.exists():
                _yolo_seg = YOLO(str(seg_p))
                log.info("ArabID segmentation model loaded — address enrichment active")
        else:
            log.warning("YOLO .pt files missing in %s — using multi-pass EasyOCR fallback", _MODEL_DIR)
        # Optional back-side detector — trained separately (see back-model-training/).
        # When present, the back pipeline crops fields with it instead of heuristics.
        back_p = _MODEL_DIR / "detect_id_back.pt"
        if back_p.exists():
            _yolo_back = YOLO(str(back_p))
            log.info("Back-side field detector loaded — trained back pipeline active")
    except ImportError:
        log.warning("ultralytics not installed — YOLO pipeline disabled")
    except Exception as exc:
        log.warning("YOLO model load failed: %s", exc)

_load_yolo_models()

# ── Governorate lookup table ─────────────────────────────────────────────────
_GOV = {
    "01": "Cairo", "02": "Alexandria", "03": "Port Said", "04": "Suez",
    "11": "Damietta", "12": "Dakahlia", "13": "Sharqia", "14": "Qalyubia",
    "15": "Kafr el-Sheikh", "16": "Gharbia", "17": "Menoufia", "18": "Beheira",
    "19": "Ismailia", "21": "Giza", "22": "Beni Suef", "23": "Fayoum",
    "24": "Minya", "25": "Asyut", "26": "Sohag", "27": "Qena",
    "28": "Aswan", "29": "Luxor", "31": "Red Sea", "32": "New Valley",
    "33": "Matruh", "34": "North Sinai", "35": "South Sinai", "88": "Foreign",
}

# Common OCR confusion: letters that look like digits on ID card fonts
_DIGIT_FIX = str.maketrans({
    'O': '0', 'o': '0', 'Q': '0',
    'I': '1', 'l': '1', '|': '1',
    'Z': '2', 'z': '2',
    'S': '5',
    'G': '6',
    'T': '7',
    'B': '8',
    'g': '9',
})

# ── Arabic text post-processing (from ArabID) ───────────────────────────────
# Strips tashkeel (harakat) that OCR sometimes reads on ID card fonts and
# collapses stray whitespace. Stopword removal is intentionally omitted —
# it corrupts proper names like عبد الله.
_RE_HARAKAT    = re.compile(r'[ؐ-ًؚ-ٟ]')
_RE_WHITESPACE = re.compile(r'\s+')

def _clean_arabic(text: str) -> str:
    text = _RE_HARAKAT.sub('', text)
    text = _RE_WHITESPACE.sub(' ', text)
    return text.strip()


def _national_id(texts: list[str]) -> Optional[str]:
    # Normalise Arabic-Indic numerals (٠-٩) → Western so the NID regex matches —
    # many real card fronts print the NID in Arabic-Indic. Scan every 14-digit
    # window and prefer one that passes the mod-11 checksum: the multipass OCR
    # variants happily produce digit soup, and structure alone can't tell a real
    # NID from a hallucinated one.
    joined = re.sub(r"\s+", "", _to_western_digits(" ".join(texts)))
    # Second pass fixes common digit/letter confusions; strip non-ASCII first so
    # Arabic text isn't corrupted by the translation table.
    ascii_only = re.sub(r"[^\x00-\x7F]", "", joined)
    fixed = ascii_only.translate(_DIGIT_FIX)
    first_hit = None
    for s in (joined, fixed):
        for i in range(max(0, len(s) - 13)):
            w = s[i:i + 14]
            if not re.fullmatch(r"[23]\d{13}", w):
                continue
            if _nid_checksum_ok is not None and _nid_checksum_ok(w):
                return w
            if first_hit is None:
                first_hit = w
    return first_hit


def _recover_nid(digits: str) -> Optional[str]:
    """Recover a 14-digit NID from an over-length YOLO digit read (15-16 digits).

    Spurious extra detections are the common digit-model failure. Drop every
    possible set of extra positions and accept ONLY when exactly one distinct
    checksum-valid candidate remains — ambiguity means abstain, never guess.
    """
    n = len(digits)
    if _nid_checksum_ok is None or not (14 < n <= 16):
        return None
    from itertools import combinations
    cands = set()
    for drop in combinations(range(n), n - 14):
        cand = "".join(d for i, d in enumerate(digits) if i not in set(drop))
        if re.fullmatch(r"[23]\d{13}", cand) and _nid_checksum_ok(cand):
            cands.add(cand)
    return cands.pop() if len(cands) == 1 else None

def _derive(nid: str) -> dict:
    if not nid or len(nid) < 14:
        return {"birth_date": "", "gender": "Unknown", "governorate": "Unknown"}
    century = "19" if nid[0] == "2" else "20"
    yy, mm, dd = nid[1:3], nid[3:5], nid[5:7]
    # Sanity check: if the derived year is in the future, the century digit was
    # misread — flip it (e.g. OCR reads '3' for someone born in the 1900s).
    full_year = int(f"{century}{yy}")
    if full_year > datetime.date.today().year:
        century = "19" if century == "20" else "20"
    gov = _GOV.get(nid[7:9], "Unknown")
    gender = "Male" if int(nid[9:13]) % 2 != 0 else "Female"
    return {"birth_date": f"{dd}/{mm}/{century}{yy}", "gender": gender, "governorate": gov}

def _arabic_name(texts: list[str]) -> tuple[str, str, str]:
    skip = re.compile(r"جمهورية|مصر|العربية|بطاقة|تحقيق|الشخصية|الرقم|القومي|"
                      r"تاريخ|الميلاد|العنوان|المحافظة|النوع|ذكر|أنثى|\d")
    arabic = re.compile(r"^[؀-ۿ\s]+$")
    candidates = [l.strip() for l in texts if arabic.match(l.strip()) and not skip.search(l) and len(l.strip()) > 3]
    full = candidates[0] if candidates else ""
    parts = full.split()
    return (parts[0] if parts else ""), (parts[1] if len(parts) > 1 else ""), full

def _address(texts: list[str]) -> str:
    label = re.compile(r"العنوان|عنوان")
    content = re.compile(r"شارع|ميدان|حي|قسم|بندر|مركز|ناحية")
    found, lines = False, []
    for line in texts:
        if label.search(line):
            found = True
            rest = label.sub("", line).strip(" :،")
            if rest: lines.append(rest)
            continue
        if found:
            if len(lines) >= 2: break
            lines.append(line.strip())
        elif content.search(line):
            lines.append(line.strip())
    return "، ".join(lines)

# ── Back-of-card parsing ──────────────────────────────────────────────────────
# The back of an Egyptian ID carries the factory serial number, marital status,
# occupation, and issue/expiry dates. (Religion is present on the card but is a
# sensitive special category and is intentionally NOT extracted — data minimisation.)

# Normalise Arabic so OCR spelling variants match: drop diacritics/tatweel,
# unify alef forms (أإآ→ا), ة→ه, ى→ي.
_AR_DIACRITICS = re.compile(r"[ًٌٍَُِّْـ]")
def _norm_ar(s: str) -> str:
    s = _AR_DIACRITICS.sub("", s)
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    return s.replace("ة", "ه").replace("ى", "ي")

# Marital-status keywords in NORMALISED form (run text through _norm_ar first).
# Includes آنسة ("Miss" = unmarried female) — very common and was being missed.
_MARITAL_NORM = [
    ("متزوج", "Married"),
    ("انسه",  "Single"),    # آنسة
    ("اعزب",  "Single"),    # أعزب
    ("عزباء", "Single"),
    ("مطلق",  "Divorced"),
    ("ارمل",  "Widowed"),
]

def _match_marital(text: str) -> str:
    n = _norm_ar(text)
    for kw, val in _MARITAL_NORM:
        if kw in n:
            return val
    return ""
_OCC_LABELS = ("المهنة", "الوظيفة", "الوظيغة", "وظيفة")
# Egyptian IDs often print an academic qualification in the occupation field.
_OCC_QUALIFICATIONS = ("بكالوريوس", "ليسانس", "دبلوم", "دكتوراه", "ماجستير", "طالب", "مهندس", "طبيب", "محاسب")
# Arabic-Indic ٠١٢٣٤٥٦٧٨٩  and  Persian ۰۱۲۳۴۵۶۷۸۹  → Western 0-9
_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_DATE_RE = re.compile(r"\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}")

def _to_western_digits(s: str) -> str:
    return s.translate(_AR_DIGITS)

def _parse_back(texts: list[str]) -> dict:
    norm = [_to_western_digits(t) for t in texts]
    joined = " ".join(norm)

    marital = _match_marital(joined)

    # Occupation: try the explicit label first, then fall back to a recognised
    # qualification/job keyword anywhere on the card (the label is often misread).
    occupation = ""
    for i, line in enumerate(norm):
        if any(lbl in line for lbl in _OCC_LABELS):
            cand = line
            for lbl in _OCC_LABELS:
                cand = cand.replace(lbl, "")
            cand = cand.strip(" :،-")
            occupation = cand or (norm[i + 1].strip() if i + 1 < len(norm) else "")
            break
    if not occupation:
        hit = next((ln for ln in norm if any(q in ln for q in _OCC_QUALIFICATIONS)), "")
        if hit:
            # Stitch on an adjacent specialisation line (e.g. "بكالوريوس فى" + "الاعلام")
            # only if it is clean Arabic text — avoid appending OCR noise/symbols.
            idx = norm.index(hit)
            tail = norm[idx + 1].strip() if idx + 1 < len(norm) else ""
            arabic_letters = sum(1 for c in tail if "؀" <= c <= "ۿ")
            clean_tail = tail and len(tail) <= 25 and arabic_letters >= max(3, len(tail) // 2)
            occupation = (hit.strip() + (" " + tail if clean_tail else "")).strip()

    # National ID on the back: the 14-digit run (after stripping spaces so
    # OCR-fragmented numbers rejoin).
    digit_runs = re.findall(r"\d{6,}", joined.replace(" ", ""))
    nid14 = next((d for d in digit_runs if len(d) == 14), "")
    national_id = nid14 or (max(digit_runs, key=len) if digit_runs else "")

    dates = _DATE_RE.findall(joined)
    issue_date  = dates[0] if len(dates) >= 1 else ""
    expiry_date = dates[1] if len(dates) >= 2 else ""

    return {
        "national_id":    national_id,
        "marital_status": marital,
        "occupation":     _clean_arabic(occupation),
        "issue_date":     issue_date,
        "expiry_date":    expiry_date,
    }


# detect_odjects.pt field classes that appear on the BACK → our output keys.
# (Per the official ID layout: the back's big number is the NID; the factory
#  serial lives on the FRONT and is captured there separately.)
_ODJ_BACK_FIELD = {
    "nid_back": "national_id",
    "issue":    "issue_date",
    "expiry":   "expiry_date",
    "job":      "occupation",
}

def _odjects_back_pipeline(path: str) -> Optional[dict]:
    """
    Back-side extraction using the existing detect_odjects.pt field detector
    (already trained on real Egyptian IDs — far stronger than the synthetic model).
    Detects national_id / issue / expiry / occupation; marital status is read by
    keyword from the demographics ('demo') block, since the model has no class for it.
    """
    if _yolo_fields is None:
        return None
    img = cv2.imread(path)
    if img is None:
        return None
    img = _deskew(img)
    try:
        det = _yolo_fields(img, verbose=False)[0]
    except Exception as exc:  # noqa: BLE001
        log.warning("detect_odjects back inference failed: %s", exc)
        return None
    if det.boxes is None or len(det.boxes) == 0:
        return None

    reader = get_reader()
    best: dict[str, tuple[float, tuple]] = {}
    demo: tuple[float, tuple] | None = None
    for b in det.boxes:
        name = det.names[int(b.cls[0])]
        conf = float(b.conf[0])
        xy   = tuple(int(v) for v in b.xyxy[0])
        if name in _ODJ_BACK_FIELD:
            key = _ODJ_BACK_FIELD[name]
            if key not in best or conf > best[key][0]:
                best[key] = (conf, xy)
        elif name == "demo" and (demo is None or conf > demo[0]):
            demo = (conf, xy)

    out = {"national_id": "", "marital_status": "", "occupation": "", "issue_date": "", "expiry_date": ""}
    for key, (_c, (x1, y1, x2, y2)) in best.items():
        crop = img[max(0, y1):y2, max(0, x1):x2]
        if crop.size == 0:
            continue
        txt = _to_western_digits(" ".join(reader.readtext(crop, detail=0, paragraph=False)).strip())
        if key == "national_id":
            digits = re.sub(r"\D", "", txt)
            out[key] = digits[:14] if len(digits) >= 14 else digits
        elif key in ("issue_date", "expiry_date"):
            m = _DATE_RE.search(txt) or re.search(r"\d{4}\s*/\s*\d{1,2}", txt)
            out[key] = (m.group(0).replace(" ", "") if m else txt)
        else:  # occupation
            out[key] = _clean_arabic(txt)

    # Marital status: keyword-match within the demographics block first…
    if demo is not None:
        x1, y1, x2, y2 = demo[1]
        crop = img[max(0, y1):y2, max(0, x1):x2]
        if crop.size:
            dtxt = " ".join(reader.readtext(crop, detail=0, paragraph=False))
            out["marital_status"] = _match_marital(dtxt)
    # …then a full-card text scan as fallback (the demo box can miss it).
    if not out["marital_status"]:
        full = " ".join(reader.readtext(img, detail=0, paragraph=False))
        out["marital_status"] = _match_marital(full)

    return out if any(out.values()) else None


def run_back_ocr(path: str) -> dict:
    """
    Core back-side extraction. Primary path is the detect_odjects.pt field
    detector (real-trained, strong on issue/expiry/occupation/nid_back); falls
    back to multi-pass EasyOCR + heuristics if detection yields nothing.
    Returns {"extracted_data": dict} with keys:
      national_id, marital_status, occupation, issue_date, expiry_date.
    """
    primary = _odjects_back_pipeline(path)
    if primary is not None:
        return {"extracted_data": primary}

    img_bgr = cv2.imread(path)
    if img_bgr is None:
        raise ValueError("Could not decode image")

    reader = get_reader()
    img_bgr = _deskew(img_bgr)
    best = {"national_id": "", "marital_status": "", "occupation": "", "issue_date": "", "expiry_date": ""}
    best_filled = -1

    for _variant_name, variant_img in _preprocessing_variants(img_bgr):
        vpath = None
        try:
            _, buf = cv2.imencode(".jpg", variant_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as vf:
                vf.write(buf.tobytes())
                vpath = vf.name
            detections = reader.readtext(vpath, detail=1, paragraph=False)
            texts = [d[1] for d in detections]
            data  = _parse_back(texts)
            filled = sum(1 for v in data.values() if v)
            if filled > best_filled:
                best, best_filled = data, filled
            if data["national_id"] and data["marital_status"]:
                break
        finally:
            if vpath:
                _secure_delete(vpath)

    return {"extracted_data": best}


def _parse(texts: list[str]) -> dict:
    nid = _national_id(texts)
    derived = _derive(nid) if nid else {}
    first, second, full = _arabic_name(texts)
    address = _address(texts)
    # Track PROVENANCE: a field read from a separate printed region is an
    # INDEPENDENT signal that can corroborate (or contradict) the NID; a field
    # DERIVED from the NID cannot (same source). Only independent fields are fed
    # to the verifier — see _attach_verification.
    independent = {}
    gender = derived.get("gender", "Unknown")
    for line in texts:
        if "ذكر" in line or "male" in line.lower():
            gender = "Male"; independent["gender"] = "Male"; break
        if "أنثى" in line or "female" in line.lower():
            gender = "Female"; independent["gender"] = "Female"; break
    gov = derived.get("governorate", "Unknown")
    gov_re = re.compile(r"المحافظة")
    for i, line in enumerate(texts):
        if gov_re.search(line):
            cand = gov_re.sub("", line).strip(" :،")
            gov = cand if cand else (texts[i + 1].strip() if i + 1 < len(texts) else gov)
            if gov and gov != "Unknown":
                independent["governorate"] = gov
            break
    return {
        "first_name":  _clean_arabic(first),
        "second_name": _clean_arabic(second),
        "full_name":   _clean_arabic(full),
        "national_id": nid or "",
        "address":     _clean_arabic(address),
        "birth_date":  derived.get("birth_date", ""),
        "governorate": gov,
        "gender":      gender,
        "serial":      nid[9:13] if nid else "",
        "face_image":  None,  # filled in by _run_ocr after face extraction
        "_independent_fields": independent,  # provenance for the verifier only
    }

# ── DeepFace (face extraction + verification) ────────────────────────────────
try:
    from deepface import DeepFace
    import scipy
    _DEEPFACE = True
    log.info("DeepFace loaded — face extraction and /verify-face are active")
except ImportError:
    _DEEPFACE = False
    log.warning("DeepFace not available — face extraction and /verify-face disabled")

_FACE_THRESHOLD: int = max(30, min(99, int(os.getenv("FACE_THRESHOLD", "75"))))

def _extract_face_from_id(image_path: str) -> Optional[str]:
    """
    Detect the face in the ID card image, crop it with 30 % padding,
    and return it as a base64-encoded JPEG string.
    Returns None if no face is found or DeepFace is unavailable.
    """
    if not _DEEPFACE:
        return None
    try:
        faces = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend="retinaface",
            enforce_detection=True,
            align=False,
        )
        if not faces:
            return None

        # Pick the largest detected face (most likely the ID photo)
        best = max(faces, key=lambda f: f["facial_area"]["w"] * f["facial_area"]["h"])
        area = best["facial_area"]
        x, y, w, h = area["x"], area["y"], area["w"], area["h"]

        img = cv2.imread(image_path)
        if img is None:
            return None

        ih, iw = img.shape[:2]
        pad_x = int(w * 0.30)
        pad_y = int(h * 0.30)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(iw, x + w + pad_x)
        y2 = min(ih, y + h + pad_y)

        crop = img[y1:y2, x1:x2]
        _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buf).decode("utf-8")

    except Exception as exc:
        log.warning("Face extraction failed: %s", exc)
        return None

def _cosine(a, b):
    va, vb = np.array(a, float), np.array(b, float)
    return float(1.0 - np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9))

# ── Perspective deskew (from National-ID-card-reader-master) ─────────────────
# Corrects tilted / angled ID card photos to a flat top-down rectangle before
# OCR. Works by finding the largest 4-corner contour in the image and applying
# a perspective warp. Falls back gracefully (returns the original) if no clean
# 4-point boundary is found.

def _order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s       = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]    # top-left  (smallest x+y)
    rect[2] = pts[np.argmax(s)]    # bottom-right (largest x+y)
    diff    = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # top-right  (smallest x-y)
    rect[3] = pts[np.argmax(diff)] # bottom-left (largest x-y)
    return rect

def _four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    rect = _order_points(pts)
    tl, tr, br, bl = rect
    max_width  = max(
        int(np.linalg.norm(br - bl)),
        int(np.linalg.norm(tr - tl)),
    )
    max_height = max(
        int(np.linalg.norm(tr - br)),
        int(np.linalg.norm(tl - bl)),
    )
    dst = np.array(
        [[0, 0], [max_width - 1, 0],
         [max_width - 1, max_height - 1], [0, max_height - 1]],
        dtype="float32",
    )
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (max_width, max_height))

def _deskew(img_bgr: np.ndarray) -> np.ndarray:
    """
    Detect the 4 corners of the ID card and apply a perspective warp so the
    card is returned as a flat top-down rectangle.
    Returns the original image unchanged if no clean 4-corner boundary is found.
    """
    h, w = img_bgr.shape[:2]
    if h == 0 or w == 0:
        return img_bgr

    # Work on a small copy (height=500) for fast edge detection
    scale = 500.0 / h
    small = cv2.resize(img_bgr, (max(1, int(w * scale)), 500))

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)

    # Underexposed cards: boost brightness before edge detection so Canny
    # can find the card border (ported from Egyptian-ID-Extraction detect_edge)
    if float(cv2.mean(gray)[0]) < 100:
        gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=30)

    # Morphological closing fills small gaps/breaks in the card border
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    gray   = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)

    # Median blur removes salt-and-pepper noise before bilateral
    gray  = cv2.medianBlur(gray, 3)
    # Bilateral preserves sharp card edges while smoothing interior
    gray  = cv2.bilateralFilter(gray, d=0, sigmaColor=15, sigmaSpace=10)
    # Lower low threshold (75→200) catches edges on dark/low-contrast backgrounds
    edged = cv2.Canny(gray, 75, 200)

    cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:5]

    small_area = small.shape[0] * small.shape[1]
    screen_cnt = None
    for c in cnts:
        peri   = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        # The card should fill most of the frame — ignore small inner rectangles
        # (chip, photo box, logos) that produce a 4-point contour but aren't the card.
        if len(approx) == 4 and cv2.contourArea(approx) >= 0.30 * small_area:
            screen_cnt = approx
            break

    if screen_cnt is None:
        return img_bgr  # no clear card-sized 4-corner boundary — leave as-is

    # Scale corners back to original resolution before warping
    pts    = screen_cnt.reshape(4, 2).astype("float32") / scale
    warped = _four_point_transform(img_bgr, pts)

    # Sanity check: an ID card is ~1.585:1. Reject warps that produce an
    # implausible shape (e.g. a thin sliver from a misdetected inner edge) or
    # that shrank the image too much — fall back to the original.
    wh, ww = warped.shape[0], warped.shape[1]
    if wh < 5 or ww < 5:
        return img_bgr
    aspect = max(ww, wh) / min(ww, wh)
    warped_area = ww * wh
    orig_area   = h * w
    if aspect > 2.6 or warped_area < 0.20 * orig_area:
        log.info("Deskew rejected — implausible result %dx%d (aspect %.1f)", ww, wh, aspect)
        return img_bgr

    log.info("Deskew applied — %dx%d → %dx%d", w, h, ww, wh)
    return warped


# ── YOLO field-level pipeline ────────────────────────────────────────────────

def _yolo_pipeline(image_path: str) -> Optional[dict]:
    """
    Field-level OCR pipeline using three YOLO models:
      1. Detect and crop the ID card from the full photo.
      2. Detect individual field regions (firstName, lastName, address, nid).
      3. OCR each field independently (smaller crop = higher accuracy).
      4. For the nid field: use digit-by-digit detection and assemble by x-position.
    Returns extracted_data dict if a valid 14-digit NID is found, else None.
    Multi-pass EasyOCR fallback is tried automatically.
    """
    if not _YOLO_AVAILABLE:
        return None
    try:
        image = cv2.imread(image_path)
        if image is None:
            return None

        # ── Step 1: crop the ID card ─────────────────────────────────────────
        card_results = _yolo_card(image_path, verbose=False)
        cropped = None
        best_conf = 0.0
        for result in card_results:
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf > best_conf:
                    best_conf = conf
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cropped = image[y1:y2, x1:x2]

        if cropped is None or cropped.size == 0:
            # Capture UIs guide the user to fill the frame with the card, so the
            # full image is usually a usable card crop; running the field/band
            # pipeline on it beats dropping straight to multi-pass EasyOCR.
            log.info("YOLO: no ID card detected — treating full frame as the card")
            cropped = image
        else:
            log.info("YOLO: ID card cropped (confidence=%.2f)", best_conf)

        # Deskew the cropped card so tilted photos don't degrade field detection
        cropped = _deskew(cropped)

        # ── Step 2: detect fields on cropped card ────────────────────────────
        field_results = _yolo_fields(cropped, verbose=False)
        reader = get_reader()
        first_name = ""
        second_name = ""
        address = ""
        nid = ""
        nid_crop = None   # tight NID region, kept for an OCR fallback
        nid_top_frac = None   # digit-row top as a fraction of card height (band anchor)
        serial = ""   # رقم المصنع — factory/serial number (front, bottom-left)

        for result in field_results:
            for box in result.boxes:
                class_name = result.names[int(box.cls[0].item())]
                x1, y1, x2, y2 = [int(c) for c in box.xyxy[0].tolist()]

                if class_name == "serial":
                    crop = cropped[y1:y2, x1:x2]
                    if crop.size:
                        gray  = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                        stxt  = reader.readtext(gray, detail=0, paragraph=False)
                        # Factory serial is alphanumeric (e.g. "JZ7712559")
                        serial = re.sub(r"[^A-Za-z0-9]", "", "".join(stxt)).upper()

                elif class_name in ("firstName", "lastName", "address"):
                    crop = cropped[y1:y2, x1:x2]
                    if crop.size == 0:
                        continue
                    # PaddleOCR (PP-OCRv6 det + arabic rec) — 81/74 vs EasyOCR's 36/24
                    # on the held-out name benchmark. EasyOCR remains the fallback.
                    text = ""
                    if _PP_READER:
                        text = _clean_arabic(_pp_read_field(crop, class_name))
                    if not text:
                        gray  = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                        texts = reader.readtext(gray, detail=0, paragraph=True)
                        text  = _clean_arabic(" ".join(texts))
                    if class_name == "firstName":
                        first_name = text
                    elif class_name == "lastName":
                        second_name = text
                    elif class_name == "address":
                        address = text

                elif class_name == "nid":
                    # Expand bbox height ×1.5 so digits aren't clipped
                    h_card   = cropped.shape[0]
                    cy       = y1 + (y2 - y1) // 2
                    new_h    = int((y2 - y1) * 1.5)
                    ey1      = max(0, cy - new_h // 2)
                    ey2      = min(h_card, cy + new_h // 2)
                    nid_crop = cropped[ey1:ey2, x1:x2]
                    nid_top_frac = y1 / max(h_card, 1)   # anchor for the text-field bands

                    # Digit-by-digit detection: class id IS the digit value (0-9)
                    digit_results = _yolo_digits(nid_crop, verbose=False)
                    digit_info = []
                    for dr in digit_results:
                        for db in dr.boxes:
                            digit_cls = int(db.cls[0])
                            dx1       = int(db.xyxy[0][0])
                            digit_info.append((digit_cls, dx1))

                    if digit_info:
                        digit_info.sort(key=lambda d: d[1])   # left → right
                        nid = "".join(str(d[0]) for d in digit_info)
                        log.info("YOLO digit NID: [%d digits]", len(nid))

        # ── Step 2b: digit-row-anchored band crops for the text fields ──────
        # The field detector mislocates boxes on hard captures (it reads the card
        # header as a name); the band geometry anchored to the NID digit row is
        # the exact crop recipe the PP reader was benchmarked on (81/74 CF vs
        # gold). Bands are the primary source; the YOLO box reads above remain
        # as fallback when a band read comes back empty.
        if _PP_READER and nid_top_frac is None:
            # No 'nid' field box — anchor on the digit ROW from the digit detector
            # instead (this is what the benchmarked cropper does): the dominant
            # horizontal run of ≥8 digit boxes in the lower card half.
            try:
                digs = []
                for dr in _yolo_digits(cropped, verbose=False):
                    for db in dr.boxes:
                        bx = db.xyxy[0].tolist()
                        digs.append(((bx[1] + bx[3]) / 2, bx[1]))
                if len(digs) >= 8:
                    import statistics as _st
                    med = _st.median(y for y, _ in digs)
                    row = [t for y, t in digs if abs(y - med) < 0.05 * cropped.shape[0]]
                    if len(row) >= 8 and med > cropped.shape[0] * 0.5:
                        nid_top_frac = min(row) / cropped.shape[0]
                        log.info("band anchor from digit row: nid_top=%.2f", nid_top_frac)
            except Exception as _ae:
                log.warning("digit-row anchor failed: %s", _ae)

        if _PP_READER and nid_top_frac is not None:
            _BANDS = {"firstName": (0.255, 0.355), "lastName": (0.355, 0.455),
                      "address": (0.455, 0.660)}
            _NID_TOP_REF, _XB = 0.80, (0.28, 1.0)
            hh, ww = cropped.shape[:2]
            shift = min(max(nid_top_frac, 0.55), 0.95) - _NID_TOP_REF
            for fld, (f0, f1) in _BANDS.items():
                by0 = int(min(max(f0 + shift, 0.0), 1.0) * hh)
                by1 = int(min(max(f1 + shift, 0.0), 1.0) * hh)
                if by1 - by0 < 8:
                    continue
                band = cropped[by0:by1, int(_XB[0] * ww):int(_XB[1] * ww)]
                t = _clean_arabic(_pp_read_field(band, fld))
                if t:
                    if fld == "firstName":
                        first_name = t
                    elif fld == "lastName":
                        second_name = t
                    else:
                        address = t

        # ── Step 3: validate NID — if invalid, try EasyOCR ──────────────────
        # The YOLO digit model only knows Western glyphs, so it fails on cards
        # whose NID is printed in Arabic-Indic numerals. Read the tight NID crop
        # (digit allowlist, Western+Arabic-Indic) and normalise, then fall back
        # to a whole-card read.
        if not re.fullmatch(r"[23]\d{13}", nid):
            recovered = _recover_nid(nid)
            if recovered:
                log.info("YOLO digit NID recovered %d→14 digits via checksum", len(nid))
                nid = recovered
        if not re.fullmatch(r"[23]\d{13}", nid):
            log.warning("YOLO digit NID invalid (%d digits) — OCR fallback", len(nid))
            nid_fallback = None
            if nid_crop is not None and nid_crop.size:
                crop_txt = reader.readtext(
                    nid_crop, detail=0, paragraph=False,
                    allowlist="0123456789٠١٢٣٤٥٦٧٨٩",
                )
                nid_fallback = _national_id(crop_txt)
            if not nid_fallback:
                all_texts = reader.readtext(cropped, detail=0, paragraph=False)
                nid_fallback = _national_id(all_texts)
            if nid_fallback:
                nid = nid_fallback
                log.info("EasyOCR NID fallback: found valid NID")
            else:
                log.info("YOLO pipeline: no valid NID found — handing off to multi-pass")
                return None

        full_name   = _clean_arabic(f"{first_name} {second_name}".strip() or first_name)
        derived     = _derive(nid)
        governorate = derived["governorate"]
        neighbourhood = ""
        city          = ""

        # ── Step 4: ArabID segmentation — address enrichment + text governorate
        # Runs segmentation.pt on the cropped card to get neighborhood / city / state
        # as separate text regions. If the NID-derived governorate is Unknown (rare
        # NID misread), the segmented "state" field fills it in from the card text.
        if _yolo_seg is not None:
            try:
                seg_results = _yolo_seg(cropped, verbose=False)
                seg_best: dict[str, tuple[float, np.ndarray]] = {}
                for result in seg_results:
                    for box in result.boxes:
                        cls_name = result.names[int(box.cls[0].item())]
                        conf     = float(box.conf[0])
                        if cls_name not in seg_best or conf > seg_best[cls_name][0]:
                            sx1, sy1, sx2, sy2 = [int(c) for c in box.xyxy[0].tolist()]
                            seg_best[cls_name] = (conf, cropped[sy1:sy2, sx1:sx2])

                for cls_name, (_, crop) in seg_best.items():
                    if crop.size == 0:
                        continue
                    gray  = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                    texts = reader.readtext(gray, detail=0, paragraph=True)
                    text  = _clean_arabic(" ".join(texts))
                    if cls_name == "neighborhood":
                        neighbourhood = text
                    elif cls_name == "city":
                        city = text
                    elif cls_name == "state" and text and governorate == "Unknown":
                        governorate = text
                        log.info("ArabID seg: governorate from state field: %s", governorate)

                # Build enriched address from segmented parts when available.
                # Skip when the PP reader already produced an address — its full-field
                # read beats concatenated EasyOCR fragments.
                if (neighbourhood or city) and not (_PP_READER and address):
                    parts = [p for p in [neighbourhood, city] if p]
                    if address and not any(p in address for p in parts):
                        parts.append(address)
                    address = "، ".join(parts)
                    log.info("ArabID seg: enriched address: %s", address)

            except Exception as exc:
                log.warning("ArabID segmentation enrichment error: %s", exc)

        return {
            "first_name":  first_name,
            "second_name": second_name,
            "full_name":   full_name,
            "national_id": nid,
            "address":     address,
            "birth_date":  derived["birth_date"],
            "governorate": governorate,
            "gender":      derived["gender"],
            "serial":      serial,   # real factory number from the YOLO 'serial' field
            "face_image":  None,   # filled in by caller after face extraction
        }

    except Exception as exc:
        log.warning("YOLO pipeline error: %s", exc)
        return None


# ── Multi-pass image preprocessing for Egyptian ID OCR ───────────────────────
def _preprocessing_variants(img_bgr: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    Return a list of (name, preprocessed_image) variants in order of
    expected quality. _run_ocr tries them in sequence and stops as soon
    as a valid 14-digit national ID is found.
    """
    h, w = img_bgr.shape[:2]
    variants = []

    # 1. CLAHE — handles uneven lighting (most common failure on ID cards)
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = cv2.merge([clahe.apply(l), a, b])
    variants.append(("clahe", cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)))

    # 2. Original (unmodified)
    variants.append(("original", img_bgr.copy()))

    # 3. Denoise + sharpen — removes JPEG artifacts, boosts edges
    denoised = cv2.fastNlMeansDenoisingColored(img_bgr, None, 8, 8, 7, 21)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    variants.append(("denoise_sharp", cv2.filter2D(denoised, -1, kernel)))

    # 4. Adaptive threshold on grayscale — makes text binary, ignores colour noise
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 4
    )
    variants.append(("adaptive_thresh", cv2.cvtColor(adaptive, cv2.COLOR_GRAY2BGR)))

    # 5a. Larger-neighbourhood adaptive threshold (block_size=21, C=10) from
    #     Egyptian-ID-Extraction: captures more spatial context on large-print cards
    adaptive2 = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10
    )
    variants.append(("adaptive_thresh_21", cv2.cvtColor(adaptive2, cv2.COLOR_GRAY2BGR)))

    # 5b. Gamma boost + CLAHE — for dark/underexposed photos where CLAHE alone
    #     is insufficient (ported from Egyptian-ID-Extraction detect_edge logic)
    mean_gray = float(cv2.mean(gray)[0])
    if mean_gray < 80:
        boosted = cv2.convertScaleAbs(gray, alpha=2.0, beta=40)
        clahe_dark = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        boosted = clahe_dark.apply(boosted)
        variants.append(("gamma_clahe", cv2.cvtColor(boosted, cv2.COLOR_GRAY2BGR)))

    # 5. Upscale × 1.5 — helps when the photo is small or low-DPI
    if max(h, w) < 1400:
        up = cv2.resize(img_bgr, (int(w * 1.5), int(h * 1.5)),
                        interpolation=cv2.INTER_LANCZOS4)
        variants.append(("upscaled", up))

    # 6. CLAHE + upscale combo (last resort)
    if max(h, w) < 1400:
        up_lab = cv2.cvtColor(up, cv2.COLOR_BGR2LAB)
        lu, au, bu = cv2.split(up_lab)
        merged = cv2.merge([clahe.apply(lu), au, bu])
        variants.append(("clahe_upscaled", cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)))

    return variants

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
@limiter.limit("20 per minute")
def health():
    return jsonify({
        "status": "healthy",
        "version": os.getenv("GIT_COMMIT", "unknown"),
        "services": {
            "egyptian_id":         True,
            "passport":            True,
            "yolo_pipeline":       _YOLO_AVAILABLE,
            "yolo_segmentation":   _yolo_seg is not None,
            "deepface":            _DEEPFACE,
        },
        "timestamp": time.time(),
    })

_MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

def _secure_delete(path: str) -> None:
    """Overwrite file with random bytes before unlinking to prevent disk recovery of PII."""
    try:
        size = os.path.getsize(path)
        with open(path, "wb") as f:
            f.write(os.urandom(size))
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        pass
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass

def run_front_ocr(path: str) -> dict:
    """
    Core front-side extraction pipeline (no HTTP layer — callable from the
    endpoint and from the local test harness).
    Returns {"extracted_data": dict, "method": str}. Raises on undecodable image.
    """
    img_bgr = cv2.imread(path)
    if img_bgr is None:
        raise ValueError("Could not decode image")

    # ── Primary: YOLO field-level pipeline ──────────────────────────────────
    # Card detection → field bounding boxes → per-field OCR → digit NID.
    # Falls back automatically if models unavailable or NID not found.
    best_data = _yolo_pipeline(path)
    method    = "yolo" if best_data is not None else None

    if best_data is not None:
        log.info("OCR: YOLO pipeline succeeded (NID=[%d digits])", len(best_data["national_id"]))

    # ── Fallback: multi-pass EasyOCR + regex ────────────────────────────────
    if best_data is None:
        reader = get_reader()
        used_variant = "none"
        # Correct perspective on the full photo before all 6 variants run
        img_bgr = _deskew(img_bgr)

        for variant_name, variant_img in _preprocessing_variants(img_bgr):
            vpath = None
            try:
                _, buf = cv2.imencode(".jpg", variant_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
                with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as vf:
                    vf.write(buf.tobytes())
                    vpath = vf.name

                detections = reader.readtext(vpath, detail=1, paragraph=False)
                texts = [d[1] for d in detections]
                data  = _parse(texts)

                if best_data is None:
                    best_data = data

                if data["national_id"]:
                    best_data    = data
                    used_variant = variant_name
                    log.info("OCR found national ID using variant: %s", variant_name)
                    break

                current_filled  = sum(1 for v in data.values()    if v and v != "Unknown")
                previous_filled = sum(1 for v in best_data.values() if v and v != "Unknown")
                if current_filled > previous_filled:
                    best_data    = data
                    used_variant = variant_name

            finally:
                if vpath:
                    _secure_delete(vpath)

        if best_data is None:
            best_data = {k: "" for k in
                ["first_name","second_name","full_name","national_id","address",
                 "birth_date","governorate","gender","serial","face_image"]}

        if not best_data.get("national_id"):
            log.warning("OCR: national ID not found in any preprocessing variant")

        method = f"easyocr/{used_variant}"

    # Face extraction always runs on the original image regardless of method
    best_data["face_image"] = _extract_face_from_id(path)
    # Deterministic verdict (checksum + structure + any independent field). This
    # is what stops a confident-but-wrong NID from being emitted silently.
    _attach_verification(best_data)
    best_data.pop("_independent_fields", None)  # internal-only; not part of the API
    return {"extracted_data": best_data, "method": method}


_DEBUG_CAPTURE_DIR = os.getenv("DEBUG_CAPTURE_DIR",
                               str(Path(__file__).parent / "debug_captures"))
_DEBUG_CAPTURE_KEEP = 40


def _save_debug_capture(data: bytes, tag: str) -> None:
    """Keep the last N raw uploads so real-capture failures are reproducible.

    Live captures are the only eval data we have for the real phone-camera
    domain (the dataset cards don't cover it). Contains PII — the dir is
    gitignored and pruned; set DEBUG_CAPTURE_DIR=off to disable.
    """
    if _DEBUG_CAPTURE_DIR.lower() in ("off", "0", ""):
        return
    try:
        d = Path(_DEBUG_CAPTURE_DIR)
        d.mkdir(exist_ok=True)
        ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        (d / f"{ts}_{tag}.jpg").write_bytes(data)
        old = sorted(d.glob("*.jpg"))[:-_DEBUG_CAPTURE_KEEP]
        for p in old:
            p.unlink(missing_ok=True)
    except Exception as e:  # pragma: no cover - never break OCR for debug I/O
        log.warning("debug capture save failed: %s", e)


def _run_ocr():
    t0 = time.time()
    if not request.data:
        return jsonify({"error": "No image data"}), 400
    if len(request.data) > _MAX_IMAGE_BYTES:
        return jsonify({"error": "Image too large (max 10 MB)"}), 413
    _save_debug_capture(request.data, "front")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(request.data)
        path = f.name

    try:
        result   = run_front_ocr(path)
        face_b64 = result["extracted_data"].get("face_image")
        return jsonify({
            "success": True,
            "processing_time": round(time.time() - t0, 2),
            "method": result["method"],
            "extracted_data": result["extracted_data"],
            "face_verification": {
                "face_detected": face_b64 is not None,
                "face_image": face_b64,
            },
        })
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        log.exception("OCR failed")
        return jsonify({"success": False, "error": str(exc)}), 500
    finally:
        _secure_delete(path)

@app.post("/egyptian-id")
@limiter.limit("30 per minute")
def egyptian_id():
    return _run_ocr()

@app.post("/ocr")
@limiter.limit("30 per minute")
def ocr():
    return _run_ocr()

@app.post("/egyptian-id-back")
@limiter.limit("30 per minute")
def egyptian_id_back():
    t0 = time.time()
    if not request.data:
        return jsonify({"success": False, "error": "No image data"}), 400
    if len(request.data) > _MAX_IMAGE_BYTES:
        return jsonify({"success": False, "error": "Image too large (max 10 MB)"}), 413
    _save_debug_capture(request.data, "back")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(request.data)
        path = f.name
    try:
        result = run_back_ocr(path)
        return jsonify({
            "success": True,
            "processing_time": round(time.time() - t0, 2),
            "extracted_data": result["extracted_data"],
        })
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        log.exception("Back-side OCR failed")
        return jsonify({"success": False, "error": str(exc)}), 500
    finally:
        _secure_delete(path)

@app.post("/passport")
@limiter.limit("30 per minute")
def passport():
    t0 = time.time()
    if not request.data:
        return jsonify({"success": False, "error": "No image data"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
        f.write(request.data)
        path = f.name

    try:
        from passport_ocr import process_passport
        result = process_passport(path)
        result["processing_time"] = round(time.time() - t0, 2)
        status = 200 if result["success"] else 422
        return jsonify(result), status
    except ImportError:
        log.warning("passport_ocr module not installed — endpoint not available")
        return jsonify({
            "success": False,
            "error": "Passport scanning is not available on this server. Please use an Egyptian National ID instead.",
        }), 501
    except Exception as exc:
        log.exception("Passport OCR route error")
        return jsonify({"success": False, "error": str(exc)}), 500
    finally:
        _secure_delete(path)

@app.post("/detect-fields")
@limiter.limit("240 per minute")
def detect_fields():
    """Live capture-guidance: detect the card + field boxes on a viewfinder frame.

    Fast path for real-time UI overlays (no OCR): downscaled YOLO passes only.
    Returns normalized [x, y, w, h] boxes (fractions of the SENT image), so the
    client can map them onto its preview regardless of resolution.
    """
    if not _YOLO_AVAILABLE:
        return jsonify({"card": None, "fields": []})
    if not request.data:
        return jsonify({"error": "No image data"}), 400
    if len(request.data) > 2 * 1024 * 1024:
        return jsonify({"error": "Frame too large (max 2 MB)"}), 413
    try:
        arr = np.frombuffer(request.data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Bad image"}), 400
        H, W = img.shape[:2]
        if W > 640:
            s = 640 / W
            img = cv2.resize(img, (640, int(H * s)))
            H, W = img.shape[:2]

        card_box = None
        best = 0.0
        for r in _yolo_card(img, verbose=False):
            for b in r.boxes:
                c = float(b.conf[0])
                if c > best and c > 0.3:
                    best = c
                    x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
                    card_box = [x1 / W, y1 / H, (x2 - x1) / W, (y2 - y1) / H]

        fields = []
        if card_box:
            cx, cy, cw, ch = [card_box[0] * W, card_box[1] * H, card_box[2] * W, card_box[3] * H]
            crop = img[int(cy):int(cy + ch), int(cx):int(cx + cw)]
            if crop.size:
                for r in _yolo_fields(crop, verbose=False):
                    for b in r.boxes:
                        name = r.names[int(b.cls[0])]
                        if name not in ("firstName", "lastName", "address", "nid"):
                            continue
                        x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
                        fields.append({
                            "name": name,
                            "conf": round(float(b.conf[0]), 2),
                            "box": [(cx + x1) / W, (cy + y1) / H,
                                    (x2 - x1) / W, (y2 - y1) / H],
                        })
        return jsonify({"card": card_box, "conf": round(best, 2), "fields": fields})
    except Exception as exc:
        log.warning("detect-fields failed: %s", exc)
        return jsonify({"card": None, "fields": []})


@app.post("/verify-face")
@limiter.limit("10 per minute")
def verify_face():
    if not _DEEPFACE:
        return jsonify({"error": "DeepFace not installed"}), 503

    if request.content_length and request.content_length > _MAX_IMAGE_BYTES * 2:
        return jsonify({"error": "Request too large (max 20 MB)"}), 413

    data = request.get_json()
    if not data or "id_image" not in data or "live_image" not in data:
        return jsonify({"error": "Both id_image and live_image are required"}), 400

    challenge_frames_b64 = data.get("challenge_frames") or []
    if not isinstance(challenge_frames_b64, list) or len(challenge_frames_b64) > 4:
        return jsonify({"error": "challenge_frames must be a list of at most 4 images"}), 400

    try:
        def decode(b64):
            arr = np.frombuffer(base64.b64decode(b64), np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Could not decode image — invalid or corrupted data")
            return img

        id_img   = decode(data["id_image"])
        live_img = decode(data["live_image"])
        challenge_imgs = [decode(f) for f in challenge_frames_b64]

        # Fast pre-checks before expensive DeepFace calls (from Android SDK quality gate logic)
        live_gray = cv2.cvtColor(live_img, cv2.COLOR_BGR2GRAY)
        live_mean = float(cv2.mean(live_gray)[0])
        if live_mean < 35:
            return jsonify({"error": "Selfie is too dark. Please move to a better-lit area."}), 422
        if live_mean > 225:
            return jsonify({"error": "Selfie is overexposed. Please avoid direct light sources."}), 422

        id_reps = DeepFace.represent(id_img, model_name="ArcFace", enforce_detection=True, detector_backend="retinaface")
        if not id_reps:
            raise ValueError("No face detected in ID image")
        id_rep    = id_reps[0]["embedding"]
        live_reps = DeepFace.represent(live_img, model_name="ArcFace", enforce_detection=True, detector_backend="retinaface")
        if not live_reps:
            raise ValueError("No face detected in selfie")
        if len(live_reps) > 1:
            return jsonify({"error": "Multiple faces detected in selfie. Please ensure only one person is in frame."}), 422
        live_rep = live_reps[0]["embedding"]

        if np.linalg.norm(id_rep) < 1e-7 or np.linalg.norm(live_rep) < 1e-7:
            return jsonify({"error": "Could not extract face features. Please try again with a clearer photo.", "error_code": "ERR_EMBED_FAILED"}), 422

        dist = _cosine(id_rep, live_rep)
        k, mid = 10, 0.6
        similarity = 100 / (1 + np.exp(k * (dist - mid)))

        THRESHOLD = _FACE_THRESHOLD
        is_match = similarity >= THRESHOLD

        # Passive liveness: reject if the selfie looks like a photo of a screen/print.
        # Laplacian variance on the live image — printed photos have very low sharpness variance.
        lap_var = float(cv2.Laplacian(live_gray, cv2.CV_64F).var())
        LIVENESS_MIN_VARIANCE = float(os.getenv("LIVENESS_MIN_VARIANCE", "50"))
        liveness_ok = lap_var >= LIVENESS_MIN_VARIANCE
        liveness_reason = "low_sharpness" if not liveness_ok else None
        liveness_mode = "passive"

        # Active liveness: challenge frames captured during a head-turn prompt.
        # A static photo/screen replay yields near-identical embeddings across frames;
        # a real head turn produces measurable embedding motion. A face swap mid-challenge
        # produces too MUCH distance. Both are rejected.
        # When challenge frames are present, the active check DECIDES — real motion by
        # the same person is direct liveness evidence, while Laplacian sharpness is
        # camera/lighting-dependent and false-flags soft webcam images (the passive
        # gate only stands alone when no challenge frames were captured).
        MOTION_MIN_DIST   = 0.05  # max pairwise distance below this → static replay
        IDENTITY_MAX_DIST = 0.68  # ArcFace same-person ceiling; above this → different person
        if challenge_imgs:
            liveness_ok = True
            liveness_reason = None
            liveness_mode = "active"
            frame_reps = []
            for c_img in challenge_imgs:
                reps = DeepFace.represent(c_img, model_name="ArcFace", enforce_detection=True, detector_backend="retinaface")
                if not reps:
                    raise ValueError("No face detected in challenge frame")
                frame_reps.append(reps[0]["embedding"])

            all_reps = [live_rep] + frame_reps
            max_pair_dist = 0.0
            for i in range(len(all_reps)):
                for j in range(i + 1, len(all_reps)):
                    d = _cosine(all_reps[i], all_reps[j])
                    max_pair_dist = max(max_pair_dist, d)
                    if d > IDENTITY_MAX_DIST:
                        liveness_ok = False
                        liveness_reason = "identity_changed"
            if liveness_ok and max_pair_dist < MOTION_MIN_DIST:
                liveness_ok = False
                liveness_reason = "no_motion"

        # Metrics only (no image data) — needed to tune thresholds on real traffic
        log.info("verify-face: sim=%.1f dist=%.3f lap_var=%.0f mode=%s frames=%d ok=%s reason=%s",
                 similarity, dist, lap_var, liveness_mode, len(challenge_imgs),
                 liveness_ok, liveness_reason)

        if not liveness_ok:
            return jsonify({
                "success": True,
                "verification_result": {
                    "is_match": False,
                    "similarity_score": round(float(similarity), 2),
                    "distance": round(float(dist), 4),
                    "threshold": THRESHOLD,
                    "liveness_failed": True,
                    "liveness_reason": liveness_reason,
                    "liveness_mode": liveness_mode,
                    "liveness_score": round(lap_var, 1),
                    "liveness_min": LIVENESS_MIN_VARIANCE,
                },
            })

        return jsonify({
            "success": True,
            "verification_result": {
                "is_match": bool(is_match),
                "similarity_score": round(float(similarity), 2),
                "distance": round(float(dist), 4),
                "threshold": THRESHOLD,
                "liveness_failed": False,
                "liveness_mode": liveness_mode,
                "liveness_score": round(lap_var, 1),
            },
        })
    except ValueError as exc:
        log.warning("verify-face: face not detected — %s", exc)
        return jsonify({"error": "No face detected. Please ensure the face is clearly visible and well-lit.", "error_code": "ERR_NO_FACE"}), 422
    except Exception as exc:
        log.exception("verify-face failed")
        return jsonify({"error": "Face verification failed due to a server error. Please try again.", "error_code": "ERR_SERVER"}), 500

if __name__ == "__main__":
    # Pre-load EasyOCR at startup so the first real request doesn't hang.
    # Model download only happens once; subsequent starts use the cached weights.
    log.info("Pre-loading EasyOCR model…")
    get_reader()
    log.info("EasyOCR ready.")

    if _pp_ping():
        log.info("PP sidecar reachable at %s — PaddleOCR active for text fields", _PP_URL)
    else:
        log.warning("PP sidecar not reachable at %s — text fields use EasyOCR "
                    "(start it: python pp_service.py)", _PP_URL)

    _local_patterns = ("localhost", "127.0.0.1", "::1", "[::1]")
    if any(p in o for o in _allowed_origins for p in _local_patterns) and not os.getenv("ALLOW_LOCALHOST"):
        log.warning(
            "ALLOWED_ORIGINS contains a loopback/localhost address (%s). "
            "Set ALLOWED_ORIGINS to the production domain before deploying, "
            "or set ALLOW_LOCALHOST=1 to suppress this warning.",
            _allowed_origins,
        )
    log.info("Face similarity threshold: %d%% (FACE_THRESHOLD env var)", _FACE_THRESHOLD)

    cert = os.getenv("TLS_CERT")   # e.g. /etc/letsencrypt/live/<domain>/fullchain.pem
    key  = os.getenv("TLS_KEY")    # e.g. /etc/letsencrypt/live/<domain>/privkey.pem
    if cert and not Path(cert).exists():
        raise FileNotFoundError(f"TLS_CERT not found: {cert}")
    if key and not Path(key).exists():
        raise FileNotFoundError(f"TLS_KEY not found: {key}")
    ssl_ctx = (cert, key) if cert and key else None
    if not ssl_ctx:
        print("WARNING: TLS_CERT/TLS_KEY not set — starting without HTTPS. "
              "Face images and ID documents will be transmitted unencrypted.")
    host = "0.0.0.0" if ssl_ctx else "127.0.0.1"
    proto = "https" if ssl_ctx else "http"
    print(f"KYC OCR Server — {proto}://{host}:5000")
    app.run(host=host, port=5000, debug=False, threaded=True, ssl_context=ssl_ctx)
