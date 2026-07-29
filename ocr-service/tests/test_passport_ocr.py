"""passport_ocr pipeline units that don't need OCR models.
(MRZ parse/validate/repair logic is covered by tests/test_mrz.py.)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np

import mrz


def _render_page_with_mrz(l1, l2, W=1600):
    """Minimal page: white, two monospace MRZ lines near the bottom."""
    import cv2
    H = int(W / 1.42)
    img = np.full((H, W, 3), 238, np.uint8)
    for i, line in enumerate((l1, l2)):
        y = int(H * (0.82 + 0.09 * i))
        cv2.putText(img, line, (int(W * 0.03), y), cv2.FONT_HERSHEY_SIMPLEX,
                    W / 1600 * 0.85, (30, 30, 30), 2, cv2.LINE_AA)
    return img


def test_locate_mrz_finds_band():
    from passport_ocr import locate_mrz
    l1, l2 = mrz.compose_td3(surname="HASSAN", given_names="MOHAMED",
                             doc_number="A23456789", birth_yymmdd="980122",
                             expiry_yymmdd="310506")
    img = _render_page_with_mrz(l1, l2)
    box = locate_mrz(img)
    assert box is not None
    x0, y0, x1, y1 = box
    H, W = img.shape[:2]
    assert y0 > H * 0.6            # band is in the lower page
    assert (x1 - x0) > W * 0.5     # spans most of the width


def test_locate_mrz_none_on_blank():
    from passport_ocr import locate_mrz
    assert locate_mrz(np.full((800, 1200, 3), 235, np.uint8)) is None


def test_egy_doc_prior_fixes_invisible_pair():
    # L->1 in an EGY doc number passes every check digit (mod-10 collision);
    # only the letter+8digits format prior can restore it.
    from passport_ocr import _egy_doc_prior
    l1, l2 = mrz.compose_td3(surname="X", given_names="Y", doc_number="L12345678",
                             birth_yymmdd="900101", expiry_yymmdd="300101")
    corrupted = "1" + l2[1:]
    p = mrz.parse_td3(l1, corrupted)
    assert p["valid_score"] == 1.0 and p["document_number"] == "112345678"
    fixed = _egy_doc_prior(p)
    assert fixed["document_number"] == "L12345678"
    assert fixed["valid_score"] == 1.0
    assert fixed["doc_number_format_ok"] is True


def test_candidate_pairs_prefer_p_line():
    from passport_ocr import _candidate_pairs
    lines = ["JUNKJUNKJUNKJUNKJUNKJUNKJUNKJUNK<<<<<<<<",
             "P<EGYHASSAN<<MOHAMED<<<<<<<<<<<<<<<<<<<<<<<<",
             "A234567890EGY9801222M31050652980122123456746"]
    pairs = _candidate_pairs(lines)
    assert pairs[0][0].startswith("P<")
