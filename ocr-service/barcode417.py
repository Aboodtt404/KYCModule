"""PDF417 decode for the Egyptian ID back strip.

The black strip on the back is a PDF417 barcode (confirmed against real cards:
guard bars + start/stop patterns; commercial readers list Egypt ID as PDF417).
Part of the payload is ENCRYPTED by the issuer — a successful decode may still
contain binary segments. What we use it for:

  * presence + successful decode = strong "this is a real machine-issued card"
    signal (a hand-mocked ID rarely carries a valid PDF417 with intact ECC);
  * any plaintext 14-digit NID in the payload = a third independent NID leg
    (front OCR <-> back printed band <-> barcode).

Resolution reality (measured on office captures 2026-07-29): at 1080x1920
capture the strip is ~700px wide -> ~2px per module after JPEG — undecodable
by any reader. The client captures ID sides at high resolution specifically so
this stage gets ≥3px/module. This module therefore treats "no decode" as a
NEUTRAL outcome, never a rejection signal.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

import cv2
import numpy as np

log = logging.getLogger("ocr-server")

try:
    import zxingcpp
    _ZXING = True
except Exception as _exc:  # noqa: BLE001
    _ZXING = False
    log.warning("zxing-cpp unavailable (%s) — PDF417 stage disabled", _exc)

try:
    from detfirst_rules import checksum_ok as _checksum_ok
except Exception:  # noqa: BLE001
    _checksum_ok = None


def _nid_candidates(text: str) -> list[str]:
    """Every checksum-valid, date/gov-plausible 14-digit window in the payload."""
    digits_blob = re.sub(r"[^0-9]", " ", text or "")
    out = []
    for run in digits_blob.split():
        for i in range(0, max(0, len(run) - 13)):
            w = run[i:i + 14]
            if w[0] not in "23":
                continue
            mm, dd = int(w[3:5]), int(w[5:7])
            if not (1 <= mm <= 12 and 1 <= dd <= 31):
                continue
            if _checksum_ok is not None and not _checksum_ok(w):
                continue
            if w not in out:
                out.append(w)
    return out


def _regions(gray: np.ndarray):
    """Candidate crops likely to contain the strip, most specific first."""
    h = gray.shape[0]
    # bottom band first (strip lives in the lower part of the back), then all
    yield gray[int(0.35 * h):, :]
    yield gray


def _variants(gray: np.ndarray):
    yield gray
    w = gray.shape[1]
    # Upscales only help when modules are under-sampled — on hi-res captures
    # (client sends ID sides at up to 12MP) they just burn decode time.
    scales = (2, 3) if w < 1600 else ((2,) if w < 2600 else ())
    for fx in scales:
        up = cv2.resize(gray, None, fx=fx, fy=fx, interpolation=cv2.INTER_CUBIC)
        yield up
        blur = cv2.GaussianBlur(up, (0, 0), 2)
        yield cv2.addWeighted(up, 1.8, blur, -0.8, 0)
    if not scales:
        blur = cv2.GaussianBlur(gray, (0, 0), 2)
        yield cv2.addWeighted(gray, 1.8, blur, -0.8, 0)
    cl = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray)
    if w < 2600:
        cl = cv2.resize(cl, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    yield cl


def decode_pdf417(frame_bgr: np.ndarray, card_bgr: Optional[np.ndarray] = None) -> Optional[dict]:
    """Try to decode the back strip. Returns
        {"text": str, "n_chars": int, "nids": [..]}   on success,
        None when nothing decodes (NEUTRAL — usually just resolution).
    `card_bgr`, when available (YOLO card crop), is tried before the raw frame.
    """
    if not _ZXING:
        return None
    sources = []
    if card_bgr is not None and card_bgr.size:
        sources.append(card_bgr)
    if frame_bgr is not None and frame_bgr.size:
        sources.append(frame_bgr)
    for src in sources:
        gray = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY) if src.ndim == 3 else src
        for reg in _regions(gray):
            for img in _variants(reg):
                try:
                    results = zxingcpp.read_barcodes(
                        img,
                        formats=zxingcpp.BarcodeFormat.PDF417,
                        try_rotate=True,
                        try_downscale=True,
                    )
                except Exception as exc:  # noqa: BLE001
                    log.warning("zxing decode error: %s", exc)
                    continue
                if results:
                    r = results[0]
                    text = r.text or ""
                    nids = _nid_candidates(text)
                    log.info("PDF417 decoded: %d chars, %d NID candidate(s)",
                             len(text), len(nids))
                    return {"text": text, "n_chars": len(text), "nids": nids}
    return None
