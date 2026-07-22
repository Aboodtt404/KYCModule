"""
Passport OCR — extracts fields from the Machine Readable Zone (MRZ)
of a standard ICAO 9303 passport (TD3 format: 2 lines × 44 chars each).

Works entirely with EasyOCR (already in the venv) — no extra dependencies.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import cv2
import easyocr
import numpy as np

log = logging.getLogger(__name__)

# ── EasyOCR singleton (English only for MRZ) ─────────────────────────────────
_mrz_reader = None

def _get_mrz_reader():
    global _mrz_reader
    if _mrz_reader is None:
        log.info("Loading EasyOCR for MRZ (English)…")
        _mrz_reader = easyocr.Reader(["en"], gpu=False)
    return _mrz_reader

# ── MRZ parsing ───────────────────────────────────────────────────────────────

_MRZ_LINE_RE = re.compile(r"[A-Z0-9<]{44}")

# Country codes — Egyptian passport = EGY
_MONTHS = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
           "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def _mrz_date(s: str) -> str:
    """Convert YYMMDD to DD/MM/YYYY with century heuristic."""
    try:
        yy, mm, dd = int(s[0:2]), int(s[2:4]), int(s[4:6])
        century = 2000 if yy <= 30 else 1900
        return f"{dd:02d}/{mm:02d}/{century + yy}"
    except Exception:
        return ""


def _mrz_name(raw: str) -> tuple[str, str, str]:
    """Parse surname<<given1<given2 from MRZ name field."""
    parts = raw.split("<<", 1)
    surname = parts[0].replace("<", " ").strip()
    given   = parts[1].replace("<", " ").strip() if len(parts) > 1 else ""
    given_parts = given.split()
    first  = given_parts[0] if given_parts else ""
    second = given_parts[1] if len(given_parts) > 1 else ""
    return first, second, f"{given} {surname}".strip()


def _parse_td3(line1: str, line2: str) -> dict:
    """
    Parse TD3 (passport) MRZ.
    Line 1: P<CCCsurname<<given1<given2<...         (44 chars)
    Line 2: doc_no<checkCC<DOB<checkSex<expiry<check (44 chars)
    """
    l1 = (line1 + "<" * 44)[:44].upper()
    l2 = (line2 + "<" * 44)[:44].upper()

    doc_type     = l1[0]
    country      = l1[2:5].replace("<", "")
    name_field   = l1[5:44]

    doc_number   = l2[0:9].replace("<", "")
    nationality  = l2[10:13].replace("<", "")
    dob_raw      = l2[13:19]
    sex_char     = l2[20]
    expiry_raw   = l2[21:27]

    first, second, full = _mrz_name(name_field)
    dob    = _mrz_date(dob_raw)
    expiry = _mrz_date(expiry_raw)
    gender = "Male" if sex_char == "M" else "Female" if sex_char == "F" else "Unknown"

    return {
        "first_name"   : first,
        "second_name"  : second,
        "full_name"    : full,
        "document_number": doc_number,
        "nationality"  : nationality,
        "country"      : country,
        "birth_date"   : dob,
        "expiry_date"  : expiry,
        "gender"       : gender,
        "doc_type"     : doc_type,
    }


def _preprocess_for_mrz(image_path: str) -> np.ndarray:
    """
    Crop the bottom 25 % of the image (where the MRZ lives), convert to
    grayscale, sharpen, and threshold for better OCR on the monospaced font.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]
    mrz_region = img[int(h * 0.72):, :]

    gray = cv2.cvtColor(mrz_region, cv2.COLOR_BGR2GRAY)

    # Sharpen
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharp = cv2.filter2D(gray, -1, kernel)

    # Binarise
    _, bw = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bw


def process_passport(image_path: str) -> dict:
    """
    Extract fields from a passport image by reading its MRZ.
    Returns {"success": bool, "data": dict|None, "error": str|None}
    """
    try:
        processed = _preprocess_for_mrz(image_path)

        reader = _get_mrz_reader()
        results = reader.readtext(processed, detail=0, paragraph=False,
                                  allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<")

        # Collect candidate MRZ lines (exactly 44 uppercase chars/digits/<)
        raw_text = " ".join(results).upper().replace(" ", "")
        mrz_lines = _MRZ_LINE_RE.findall(raw_text)

        if len(mrz_lines) < 2:
            # Fallback: try full image without preprocessing
            full_results = reader.readtext(image_path, detail=0, paragraph=False,
                                           allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<")
            raw_text = " ".join(full_results).upper().replace(" ", "")
            mrz_lines = _MRZ_LINE_RE.findall(raw_text)

        if len(mrz_lines) < 2:
            return {"success": False, "data": None,
                    "error": "Could not detect MRZ in the image. Ensure the full passport data page is visible."}

        # Use the last two 44-char lines (standard position for TD3)
        line1, line2 = mrz_lines[-2], mrz_lines[-1]
        data = _parse_td3(line1, line2)

        log.info("Passport OCR success: %s  %s  %s", data["full_name"], data["document_number"], data["nationality"])
        return {"success": True, "data": data, "error": None}

    except Exception as exc:
        log.exception("Passport OCR error")
        return {"success": False, "data": None, "error": str(exc)}


def get_passport_debug_info(image_path: str) -> Optional[dict]:
    try:
        reader = _get_mrz_reader()
        results = reader.readtext(image_path, detail=0, paragraph=False)
        return {"raw_text_lines": results}
    except Exception:
        return None
