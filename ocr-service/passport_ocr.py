"""Passport OCR — ICAO 9303 TD3 MRZ pipeline.

Architecture (mirrors the NID front pipeline's staged shape):
  1. LOCATE the MRZ band morphologically (blackhat -> x-gradient -> close ->
     wide-bar contours near the page bottom) — never a fixed bottom crop; real
     phone captures put the page anywhere in the frame.
  2. DESKEW the band from its own minAreaRect angle.
  3. READ with EasyOCR (allowlist A-Z0-9<) over enhancement variants, grouping
     detections into rows; candidate line pairs are scored by mrz.parse_td3.
  4. VALIDATE deterministically: all five ICAO check digits + composite-gated
     confusion repair (mrz.py). valid_score==1.0 means every machine-checkable
     field is self-consistent — the passport analogue of the NID checksum gate.
  5. EGYPT PRIORS: issuing_country EGY => document number must be one letter +
     8 digits; this fixes the confusion pairs that are mod-10 INVISIBLE to
     check digits (L<->1, G<->6 collide in the 7-3-1 scheme).

Egyptian facts that shape this module (researched 2026-07-29): TD3 since 2008,
NO chip (no NFC leg), the 14-digit NID is NOT in the MRZ optional field — it
is printed Arabic-only in the VIZ (server-side cross-check reads it there and
verifies NID digits 2-7 == MRZ DOB), and the data page carries a PDF417
(decoded as a redundancy leg by the endpoint). Names in the MRZ are the
holder's chosen romanization of ONE undivided Arabic name chain — never
require exact equality against Arabic-OCR names.
"""
from __future__ import annotations

import datetime
import logging
import re

import cv2
import numpy as np

import mrz

log = logging.getLogger(__name__)

# ── EasyOCR singleton (English only for MRZ) ─────────────────────────────────
_mrz_reader = None


def _get_mrz_reader():
    global _mrz_reader
    if _mrz_reader is None:
        import easyocr
        log.info("Loading EasyOCR for MRZ (English)…")
        _mrz_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _mrz_reader


_ALLOW = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"


# ── Stage 1: locate the MRZ band ─────────────────────────────────────────────

def locate_mrz(bgr: np.ndarray):
    """Return (x0, y0, x1, y1) of the MRZ band in full-res coords, or None.
    MRZ lines close into bars 30-45x wider than tall under a horizontal
    morphological close; the band is the bottom-most cluster of such bars."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY) if bgr.ndim == 3 else bgr
    H, W = gray.shape
    scale = 1000 / W
    g = cv2.resize(gray, (1000, max(1, int(H * scale))))
    rect = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
    black = cv2.morphologyEx(g, cv2.MORPH_BLACKHAT, rect)
    gx = np.absolute(cv2.Sobel(black, cv2.CV_32F, 1, 0, ksize=-1))
    gx = (255 * (gx - gx.min()) / max(1e-5, float(gx.max() - gx.min()))).astype(np.uint8)
    gx = cv2.morphologyEx(gx, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3)))
    thr = cv2.threshold(gx, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    thr = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (40, 3)))
    thr = cv2.erode(thr, None, iterations=2)
    cnts, _ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cands = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if w / max(1, h) > 6 and w > 0.45 * 1000:
            cands.append((x, y, w, h))
    if not cands:
        return None
    cands.sort(key=lambda b: b[1] + b[3])
    bottom = cands[-1]
    group = [b for b in cands
             if abs((b[1] + b[3] / 2) - (bottom[1] + bottom[3] / 2)) < 6 * bottom[3]]
    x0 = min(b[0] for b in group); x1 = max(b[0] + b[2] for b in group)
    y0 = min(b[1] for b in group); y1 = max(b[1] + b[3] for b in group)
    padx, pady = 30, int(1.2 * bottom[3])
    x0, y0 = max(0, x0 - padx), max(0, y0 - pady)
    x1, y1 = min(1000, x1 + padx), min(g.shape[0], y1 + pady)
    inv = 1 / scale
    return int(x0 * inv), int(y0 * inv), int(x1 * inv), int(y1 * inv)


# ── Stage 2: deskew the band ─────────────────────────────────────────────────

def _deskew_band(crop: np.ndarray) -> np.ndarray:
    """Small-angle deskew from the dominant text orientation in the band."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.ndim == 3 else crop
    black = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT,
                             cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5)))
    thr = cv2.threshold(black, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    pts = cv2.findNonZero(thr)
    if pts is None or len(pts) < 100:
        return crop
    angle = cv2.minAreaRect(pts)[-1]
    if angle > 45:
        angle -= 90
    if abs(angle) < 0.3 or abs(angle) > 15:
        return crop
    h, w = crop.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(crop, M, (w, h), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)


# ── Stage 3: read candidate lines ────────────────────────────────────────────

def _variants(gray: np.ndarray):
    yield gray
    yield cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray)
    yield cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]


def _read_rows(img: np.ndarray) -> list[str]:
    """EasyOCR detections grouped into text rows (top->bottom, left->right)."""
    res = _get_mrz_reader().readtext(img, detail=1, paragraph=False, allowlist=_ALLOW)
    rows: dict[float, list] = {}
    for box, txt, _conf in res:
        cy = sum(p[1] for p in box) / 4
        key = None
        if rows:
            nearest = min(rows, key=lambda k: abs(k - cy))
            if abs(nearest - cy) < 30:
                key = nearest
        if key is None:
            key = cy
        rows.setdefault(key, []).append((min(p[0] for p in box), txt))
    lines = []
    for key in sorted(rows):
        lines.append("".join(t for _, t in sorted(rows[key])).replace(" ", ""))
    return [ln for ln in lines if len(ln) >= 30]


def _candidate_pairs(lines: list[str]):
    """Adjacent row pairs, most-MRZ-like first: line2 of a TD3 starts with the
    doc number and line1 with 'P<'; prefer pairs where that shape holds."""
    pairs = []
    for i in range(len(lines) - 1):
        a, b = lines[i], lines[i + 1]
        score = 0
        if a.startswith("P"):
            score += 2
        if "<<" in a:
            score += 1
        if re.match(r"^[A-Z0-9]{2}", b):
            score += 1
        pairs.append((score, a, b))
    pairs.sort(key=lambda p: -p[0])
    return [(a, b) for _, a, b in pairs]


# ── Stage 5: Egypt-specific format prior ─────────────────────────────────────

# Which LETTERS a digit glyph plausibly was (visual similarity) — intersected
# with check-digit arithmetic below, so a '1' at a letter position becomes L
# (cd-compatible) rather than I (cd-breaking) without guessing.
_DIGIT_TO_LETTERS = {"0": "ODQ", "1": "IL", "2": "Z", "4": "A",
                     "5": "S", "6": "G", "7": "T", "8": "B"}


def _egy_doc_prior(parsed: dict) -> dict:
    """Egyptian passport numbers are one letter + 8 digits. Force that shape
    onto the doc-number field and re-validate — the only way to catch the
    confusion pairs check digits are blind to (L=21≡1 and G=16≡6 mod 10 make
    L<->1 / G<->6 swaps invisible to every check digit)."""
    if parsed.get("issuing_country") != "EGY":
        return parsed

    def _flag(p):
        p["doc_number_format_ok"] = bool(re.fullmatch(r"[A-Z]\d{8}", p["document_number"]))
        return p

    l2 = parsed["line2"]
    field = l2[0:9]
    if re.fullmatch(r"[A-Z]\d{8}", field):
        return _flag(parsed)

    # positions 1..8 must be digits — a letter there is definitionally misread
    body = mrz._digits(field[1:])
    # position 0 must be a letter — a digit there was a letter; candidates are
    # the visually-similar letters that keep the field check digit valid
    heads = [field[0]] if field[0].isalpha() else [
        c for c in _DIGIT_TO_LETTERS.get(field[0], "")
        if mrz.check_digit(c + body) == l2[9]
    ]
    if len(heads) != 1 or not re.fullmatch(r"[A-Z]\d{8}", heads[0] + body):
        return _flag(parsed)
    forced = heads[0] + body
    if forced == field:
        return _flag(parsed)
    cand = forced + l2[9:]
    if mrz.check_digit(cand[0:9]) == cand[9] and \
            mrz.check_digit(mrz._composite_input(cand)) == cand[43]:
        return _flag(mrz.parse_td3(parsed["line1"], cand))
    return _flag(parsed)


# ── Public API ───────────────────────────────────────────────────────────────

def process_passport(image_path: str) -> dict:
    """Extract + validate the TD3 MRZ. Returns
      {"success": bool, "data": dict|None, "error": str|None}
    data carries every field plus the full check breakdown and a verdict:
      ACCEPT  — every ICAO check digit validates (and doc not expired)
      ABSTAIN — anything less; the read is reported but must not auto-pass.
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Could not decode image")

        crops = []
        box = locate_mrz(img)
        if box:
            x0, y0, x1, y1 = box
            crops.append(_deskew_band(img[y0:y1, x0:x1]))
        # fallback: bottom 30% (page fills the guide frame in the capture UX)
        h = img.shape[0]
        crops.append(_deskew_band(img[int(h * 0.70):, :]))

        best = None
        for crop in crops:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            w = gray.shape[1]
            if w < 1800:
                gray = cv2.resize(gray, (1800, int(gray.shape[0] * 1800 / w)),
                                  interpolation=cv2.INTER_CUBIC)
            for var in _variants(gray):
                lines = _read_rows(var)
                for l1, l2 in _candidate_pairs(lines):
                    parsed = mrz.parse_td3(l1, l2)
                    parsed = _egy_doc_prior(parsed)
                    if best is None or parsed["valid_score"] > best["valid_score"]:
                        best = parsed
                    if best["valid_score"] == 1.0:
                        break
                if best is not None and best["valid_score"] == 1.0:
                    break
            if best is not None and best["valid_score"] == 1.0:
                break

        if best is None:
            return {"success": False, "data": None,
                    "error": "Could not find a machine-readable zone. Capture the full data page, avoid glare."}

        today = datetime.date.today()
        expired = bool(best["expiry_date"]) and \
            datetime.date.fromisoformat(best["expiry_date"]) < today
        name_truncated = best["line1"][43] != "<"

        verdict = "ACCEPT" if (best["valid_score"] == 1.0 and not expired) else "ABSTAIN"
        data = {
            "doc_type": best["doc_type"],
            "doc_code": best["line1"][0:2].replace("<", ""),
            "issuing_country": best["issuing_country"],
            "surname": best["surname"],
            "given_names": best["given_names"],
            "full_name": best["full_name"],
            "name_truncated": name_truncated,
            "document_number": best["document_number"],
            "doc_number_format_ok": best.get("doc_number_format_ok"),
            "nationality": best["nationality"],
            "birth_date": best["birth_date"],
            "sex": best["sex"],
            "expiry_date": best["expiry_date"],
            "expired": expired,
            "personal_number": best["personal_number"],
            "mrz": {
                "line1": best["line1"], "line2": best["line2"],
                "checks": best["checks"],
                "checks_passed": best["checks_passed"],
                "checks_total": best["checks_total"],
                "valid_score": best["valid_score"],
            },
            "verdict": verdict,
        }
        log.info("Passport MRZ: %s %s score=%.2f verdict=%s",
                 data["document_number"], data["issuing_country"],
                 best["valid_score"], verdict)
        return {"success": True, "data": data, "error": None}

    except Exception as exc:  # noqa: BLE001
        log.exception("Passport OCR error")
        return {"success": False, "data": None,
                "error": "Passport processing failed. Try a clearer photo of the data page."}


def get_passport_debug_info(image_path: str) -> dict | None:
    try:
        img = cv2.imread(image_path)
        box = locate_mrz(img) if img is not None else None
        return {"mrz_box": box}
    except Exception:  # noqa: BLE001
        return None
