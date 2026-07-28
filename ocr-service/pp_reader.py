"""pp_reader.py — PaddleOCR Arabic text-field reader for the serving pipeline.

Benchmarked on the 220 held-out TEST cards vs claude_gold_v2 (2026-07-25):
PP-OCRv6_medium_det + arabic_PP-OCRv5_mobile_rec + TRAIN-frozen post-process =
firstName 81.3 / lastName 74.0 / address 63.6 content-fair — vs EasyOCR (the previous
reader) at 35.6 / 24.2 / 19.1. NID digits stay on the YOLO+checksum hybrid; this module
only reads the Arabic text fields (firstName / lastName / address).

Post-process = punctuation-token strip + TRAIN-only gazetteer respace/snap, params
frozen on a TRAIN-val slice (textread/pp_postproc_params.json). Zero TEST leakage.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import cv2

log = logging.getLogger(__name__)

_DIR = Path(__file__).parent
sys.path.insert(0, str(_DIR / "textread"))

_ocr = None
_gaz = None
_params = None
_device = None

PUNCT_TOKENS = {".", "،", "؛", ":", "·", "*", "٠", "-", "..", "۔"}
_FIELD_KIND = {"firstName": "firstName", "lastName": "lastName", "address": "address"}
# Scale crops toward ~256px height (≈2 text lines), never more than 8x and never
# past 2048px wide — a fixed target width blows tight single-word crops up so far
# the detector finds nothing at all.
TARGET_H = 256
MAX_SCALE = 8
MAX_W = 2048


def available() -> bool:
    return _ocr is not None


def init() -> bool:
    """Load models + gazetteer. GPU if present (with a VRAM guard for the shared
    tenant on GPU0), CPU otherwise. Returns True when the PP reader is active."""
    global _ocr, _gaz, _params, _device
    if _ocr is not None:
        return True
    try:
        from paddleocr import PaddleOCR

        device = os.getenv("PP_DEVICE") or _pick_device()
        kwargs = dict(
            device=device,
            text_detection_model_name="PP-OCRv6_medium_det",
            text_recognition_model_name="arabic_PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        if device == "cpu":
            kwargs["enable_mkldnn"] = False  # paddle 3.3 PIR/oneDNN bug on the det model
        try:
            _ocr = PaddleOCR(**kwargs)
        except Exception as gpu_err:
            if device != "cpu":
                log.warning("pp_reader: %s init failed (%s) — falling back to CPU", device, gpu_err)
                kwargs["device"] = "cpu"
                kwargs["enable_mkldnn"] = False
                _ocr = PaddleOCR(**kwargs)
            else:
                raise
        _device = kwargs["device"]

        import gazetteer as G  # textread/ on sys.path
        _gaz = G.build_gazetteer()
        _params = json.load(open(_DIR / "textread" / "pp_postproc_params.json"))
        log.info("pp_reader active — PP-OCRv6 det + arabic rec on %s, gazetteer loaded", _device)
        return True
    except Exception as e:
        log.warning("pp_reader unavailable (%s) — text fields fall back to EasyOCR", e)
        _ocr = None
        return False


def _pick_device() -> str:
    try:
        import subprocess
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5)
        free = int(out.stdout.strip().splitlines()[0])
        if free >= 7000:  # house rule: never squeeze the protected GPU0 tenant
            return "gpu:0"
        log.info("pp_reader: only %d MiB free on GPU0 — using CPU", free)
    except Exception:
        pass
    return "cpu"


def _rtl_join(items) -> str:
    """Group det boxes into rows (y-proximity), sort rows top→bottom, RTL within."""
    if not items:
        return ""
    rows = []
    for box, text in sorted(items, key=lambda it: (it[0][1] + it[0][3]) / 2):
        yc = (box[1] + box[3]) / 2
        h = max(box[3] - box[1], 1)
        placed = False
        for row in rows:
            ry = sum((b[1] + b[3]) / 2 for b, _ in row) / len(row)
            rh = sum(max(b[3] - b[1], 1) for b, _ in row) / len(row)
            if abs(yc - ry) < 0.6 * max(h, rh):
                row.append((box, text)); placed = True
                break
        if not placed:
            rows.append([(box, text)])
    out = []
    for row in rows:
        row.sort(key=lambda it: -(it[0][0] + it[0][2]) / 2)
        out.append(" ".join(t for _, t in row))
    return " ".join(out).strip()


def _postprocess(text: str, kind: str) -> str:
    text = " ".join(t for t in (text or "").split() if t not in PUNCT_TOKENS)
    if _gaz is None or _params is None:
        return text
    try:
        import gazetteer as G
        p = _params.get(kind) or {}
        return G.correct_field(text, _gaz, kind,
                               p.get("max_ed", 1), p.get("do_respace", True), p.get("do_snap", True))
    except Exception:
        return text


def read_field(bgr_crop, field: str) -> str:
    """Read one YOLO field crop (BGR ndarray). field ∈ firstName|lastName|address."""
    if _ocr is None or bgr_crop is None or bgr_crop.size == 0:
        return ""
    h, w = bgr_crop.shape[:2]
    scale = min(MAX_SCALE, MAX_W / max(w, 1), max(1.0, TARGET_H / max(h, 1)))
    if scale > 1.01:
        bgr_crop = cv2.resize(bgr_crop, (max(1, int(w * scale)), max(1, int(h * scale))),
                              interpolation=cv2.INTER_LANCZOS4)
    res = _ocr.predict(bgr_crop)[0]
    texts = res.get("rec_texts") or []
    boxes = res.get("rec_boxes")
    if boxes is None:
        boxes = [[min(p[0] for p in poly), min(p[1] for p in poly),
                  max(p[0] for p in poly), max(p[1] for p in poly)]
                 for poly in (res.get("rec_polys") or [])]
    items = [([float(v) for v in list(b)], t.strip()) for b, t in zip(boxes, texts) if t and t.strip()]
    return _postprocess(_rtl_join(items), _FIELD_KIND.get(field, "address"))
