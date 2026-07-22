"""
Egyptian National-ID verifier — the free correctness oracle.

This package turns a document's own checksum + internal structure into a
correctness oracle for ID extraction. It is the heart of the "zero
confident-error" methodology (see for-team/plan-kyc-methodology-test.md §3):

    1. checksum.py     — the real 14th-digit check-digit algorithm
    2. governorates.py — gov code -> name (single source of truth)
    3. decode.py       — decode century/DOB/gov/gender from a 14-digit NID
    4. verifier.py     — per-field pass/fail + a calibrated ACCEPT/ABSTAIN/REJECT verdict

It is ADDITIVE: it never imports from or mutates Wael's live server.py. The
governorate table is re-derived here so this package stands alone and can be
unit-tested without loading the OCR stack.
"""

from .checksum import check_digit, is_valid_checksum, CHECKSUM_ALGORITHM
from .decode import decode_nid, NidDecode
from .governorates import GOVERNORATES, governorate_name
from .verifier import (
    NIDVerifier,
    VerifierResult,
    Verdict,
    FieldCheck,
)

__all__ = [
    "check_digit",
    "is_valid_checksum",
    "CHECKSUM_ALGORITHM",
    "decode_nid",
    "NidDecode",
    "GOVERNORATES",
    "governorate_name",
    "NIDVerifier",
    "VerifierResult",
    "Verdict",
    "FieldCheck",
]
