"""
The Egyptian National-ID check digit — the free correctness oracle.

ALGORITHM (verified, not guessed)
---------------------------------
The 14th digit is a weighted-sum modulo-11 check digit over the first 13
digits, with weights:

    [2, 7, 6, 5, 4, 3, 2,  7, 6, 5, 4, 3, 2]

    s     = sum(d[i] * w[i] for i in 0..12)
    r     = s % 11
    k     = 11 - r           # then collapse k==10 -> 0, k==11 -> 1
    valid = (k == d[13])

PROVENANCE / CROSS-CHECK (see for-team/CHECKSUM-ORACLE.md)
  * Two INDEPENDENT open implementations converge on this exact algorithm:
      - MohamedAAbdallah/Egyptian-ID-Validator  (Python / JS / Java)
      - mahmoudEbeid2/egyptian-national-id       (TypeScript; validate + generate)
    The two final-step formulations are provably identical for all inputs.
  * Independent test vectors (from those repos):
      30012240199930 -> INVALID   (their negative test asserts exactly this)
      30012240199931 -> VALID
      29509181201214 -> VALID
  * REAL-DATA ORACLE: a real consented back in this repo (real_57_Back) carries
    NID 29204292400211, which is VALID under this algorithm AND decodes
    self-consistently (1992-04-29, gov 24=Minya, gender digit odd == printed ذكر).
    A government-issued ID is valid by construction, so this is the gold-standard
    confirmation that the algorithm — not merely a plausible one — is correct.
  * NOTE: there is no Ministry-of-Interior public spec. This is the strongest
    available cross-check (two independent authors + real data). If a future
    real-back ever fails it, that is a falsification signal — re-open this file.
    The harness reports real-back checksum pass-rate precisely so this stays
    honest (a wrong algorithm would crater that rate).

This is a STRUCTURAL/transcription oracle: a number can pass the checksum and
still not belong to a registered citizen. Its power is the converse — a
single-digit OCR misread of a valid number almost always BREAKS the checksum,
so a confidently-wrong number is caught instead of emitted.

KNOWN BLIND SPOT (measured, not hidden)
  Single-digit-error catch rate is 98.20%, not 100%. The algorithm collapses
  BOTH remainder 0 and remainder 10 to check digit 1 (k=11-0=11->1, k=11-10=1).
  A pure ISO-7064 mod-11 would emit 'X' for remainder 10 and catch 100%. So a
  single-digit error that shuttles the remainder between 0 and 10 escapes —
  but only for numbers whose remainder is already 0 or 10 (~2/11 of NIDs), and
  only the specific delta that lands on the other value. 100% of escapes are
  exactly this collapse (proven in tests). This is WHY the verifier never
  relies on the checksum alone: cross-field consistency (DOB/gender/gov) and
  the abstain-or-verify protocol cover the residual. Documented in the §7
  scorecard as a real limitation.
"""

from __future__ import annotations

CHECKSUM_ALGORITHM = "weighted-sum-mod11/[2,7,6,5,4,3,2,7,6,5,4,3,2]"

# Weights applied to digits d[0..12]. d[13] is the check digit being verified.
_WEIGHTS: tuple[int, ...] = (2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2)

_AR2WEST = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _normalize(nid: str) -> str:
    """Normalise Arabic-Indic numerals to Western and strip non-digits."""
    return "".join(ch for ch in nid.translate(_AR2WEST) if ch.isdigit())


def check_digit(first13: str) -> int:
    """Compute the correct 14th check digit for the given first-13 digits.

    `first13` may contain Arabic-Indic numerals / separators; they are
    normalised. Raises ValueError unless exactly 13 digits remain.
    """
    digits = _normalize(first13)
    if len(digits) != 13:
        raise ValueError(
            f"check_digit() needs exactly 13 digits, got {len(digits)}: {digits!r}"
        )
    s = sum(int(d) * w for d, w in zip(digits, _WEIGHTS))
    r = s % 11
    k = 11 - r
    if k == 10:
        k = 0
    elif k == 11:
        k = 1
    return k


def is_valid_checksum(nid: str) -> bool:
    """True iff `nid` is exactly 14 digits and its check digit is correct.

    Accepts Arabic-Indic numerals and embedded separators. A non-14-digit
    input is False (it cannot be a valid NID), never an exception — the
    verifier wants a clean boolean here.
    """
    digits = _normalize(nid)
    if len(digits) != 14:
        return False
    try:
        expected = check_digit(digits[:13])
    except ValueError:
        return False
    return expected == int(digits[13])
