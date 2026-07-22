"""
Verifier-level tests: decode correctness, cross-field consistency, front==back,
and the calibrated verdict — including positive controls that go RED:
  * a corrupted NID must be REJECTed,
  * an OCR field that disagrees with the decoded NID must be REJECTed.
"""
import random

import pytest

from verifier import NIDVerifier, Verdict
from verifier.decode import decode_nid
from .conftest import make_valid_nid

V = NIDVerifier()

REAL = "29204292400211"   # real back: 1992-04-29, Minya(24), Male


# ---- decode ----------------------------------------------------------------

def test_decode_real_back():
    d = decode_nid(REAL)
    assert d.structural_ok
    assert d.birth_date == "29/04/1992"
    assert d.gov_code == "24" and d.governorate == "Minya"
    assert d.gender == "Male"
    assert d.check_digit == "1"


def test_decode_rejects_impossible_month():
    d = decode_nid("29213292400217")  # month 13
    assert not d.structural_ok
    assert any("calendar" in r or "month" in r.lower() for r in d.reasons)


def test_decode_rejects_unassigned_gov():
    # gov code 99 is not assigned
    nid = make_valid_nid(gov="99")  # checksum valid but gov invalid
    d = decode_nid(nid)
    assert not d.structural_ok
    assert any("governorate" in r for r in d.reasons)


# ---- verdict: accept path --------------------------------------------------

def test_valid_nid_high_confidence_accepts():
    r = V.verify(REAL, ocr_confidence=0.97)
    assert r.verdict == Verdict.ACCEPT
    assert r.checksum_valid
    assert r.score >= 0.90


def test_valid_nid_low_confidence_abstains_not_accepts():
    """A checksum-valid number with weak OCR confidence must ABSTAIN (re-scan),
    never silently ACCEPT — names aren't checksum-protected."""
    r = V.verify(REAL, ocr_confidence=0.40)
    assert r.checksum_valid
    assert r.verdict == Verdict.ABSTAIN


def test_corroboration_lifts_score_to_accept():
    """Cross-field agreement should push a medium-confidence read to ACCEPT."""
    r = V.verify(
        REAL,
        ocr_fields={"birth_date": "29/04/1992", "gender": "Male", "governorate": "المنيا"},
        ocr_confidence=0.80,
    )
    assert all(c.passed for c in r.checks if c.name in ("dob_match", "gender_match", "gov_match"))
    assert r.verdict == Verdict.ACCEPT
    assert r.score > 0.80


# ---- verdict: reject path (positive controls — must go RED) ----------------

def test_corrupted_nid_is_rejected():
    rng = random.Random(5)
    for _ in range(50):
        nid = make_valid_nid(rng=rng)
        # flip a prefix digit (not the {0,10} collapse-prone check digit logic;
        # pick a digit and ensure the corruption actually breaks checksum)
        from verifier.checksum import is_valid_checksum
        corrupted = None
        for pos in range(13):
            for repl in "0123456789":
                if repl != nid[pos]:
                    cand = nid[:pos] + repl + nid[pos + 1:]
                    if not is_valid_checksum(cand):
                        corrupted = cand
                        break
            if corrupted:
                break
        r = V.verify(corrupted, ocr_confidence=0.99)  # high confidence, but wrong
        assert r.verdict == Verdict.REJECT, f"{corrupted} should be REJECTED"
        assert r.score == 0.0


def test_dob_mismatch_rejects():
    r = V.verify(REAL, ocr_fields={"birth_date": "01/01/1990"}, ocr_confidence=0.99)
    assert r.verdict == Verdict.REJECT
    assert any(c.name == "dob_match" and c.passed is False for c in r.checks)


def test_gender_mismatch_rejects():
    r = V.verify(REAL, ocr_fields={"gender": "Female"}, ocr_confidence=0.99)
    assert r.verdict == Verdict.REJECT
    assert any(c.name == "gender_match" and c.passed is False for c in r.checks)


def test_gov_mismatch_rejects():
    r = V.verify(REAL, ocr_fields={"governorate": "Cairo"}, ocr_confidence=0.99)
    assert r.verdict == Verdict.REJECT


def test_front_back_mismatch_rejects():
    other = make_valid_nid(yy=80, mm=1, dd=1, gov="01")
    r = V.verify(REAL, back_nid=other, ocr_confidence=0.99)
    assert r.verdict == Verdict.REJECT
    assert any(c.name == "front_back_match" and c.passed is False for c in r.checks)


def test_front_back_match_passes():
    r = V.verify(REAL, back_nid=REAL, ocr_confidence=0.95)
    assert any(c.name == "front_back_match" and c.passed is True for c in r.checks)
    assert r.verdict == Verdict.ACCEPT


def test_wrong_length_rejected():
    r = V.verify("12345", ocr_confidence=0.99)
    assert r.verdict == Verdict.REJECT


def test_arabic_gov_match():
    # decoded gov 24 == Minya == المنيا
    r = V.verify(REAL, ocr_fields={"governorate": "المنيا"}, ocr_confidence=0.95)
    assert any(c.name == "gov_match" and c.passed is True for c in r.checks)


def test_result_serialises():
    r = V.verify(REAL, ocr_confidence=0.95)
    d = r.to_dict()
    assert d["verdict"] == "ACCEPT"
    assert d["checksum_valid"] is True
    assert d["algorithm"].startswith("weighted")
