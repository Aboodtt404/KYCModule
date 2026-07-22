"""
Decode the structured fields embedded in a 14-digit Egyptian National ID.

Layout (14 digits):
    pos 0      century flag   (2 -> 1900s, 3 -> 2000s)
    pos 1..2   year   (YY)
    pos 3..4   month  (MM)
    pos 5..6   day    (DD)
    pos 7..8   governorate code
    pos 9..12  serial within the (birth-date, gov) cohort
    pos 12     gender digit   (odd -> Male, even -> Female)   [last serial digit]
    pos 13     check digit

This module ONLY decodes; it does not assert correctness. The verifier
(verifier.py) layers the checksum + cross-field consistency on top. Decoding a
structurally-impossible NID (e.g. month 13) yields a NidDecode with
`structural_ok=False` and the offending reason, rather than throwing — the
verifier turns that into a REJECT.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field

from .governorates import governorate_name, is_valid_gov_code

# Arabic-Indic <-> Western digit normalisation (cards often print ٠-٩).
_AR2WEST = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

_CENTURY = {"2": 1900, "3": 2000, "4": 2100}


def to_western_digits(s: str) -> str:
    """Normalise Arabic-Indic numerals to Western and strip non-digits."""
    return "".join(ch for ch in s.translate(_AR2WEST) if ch.isdigit())


@dataclass
class NidDecode:
    raw: str
    structural_ok: bool
    reasons: list[str] = field(default_factory=list)
    century_digit: str = ""
    birth_year: int | None = None
    birth_month: int | None = None
    birth_day: int | None = None
    birth_date: str = ""          # DD/MM/YYYY, '' if undecodable
    birth_date_iso: str = ""      # YYYY-MM-DD, '' if undecodable
    gov_code: str = ""
    governorate: str = "Unknown"
    serial: str = ""
    gender_digit: str = ""
    gender: str = "Unknown"       # 'Male' | 'Female' | 'Unknown'
    check_digit: str = ""


def decode_nid(nid: str) -> NidDecode:
    """Decode a (normalised) 14-digit NID into its structured fields.

    Performs structural validation of every component (length, century flag,
    real calendar date, assigned governorate code) but NOT the checksum.
    """
    digits = to_western_digits(nid)
    reasons: list[str] = []

    if len(digits) != 14:
        return NidDecode(
            raw=digits,
            structural_ok=False,
            reasons=[f"length={len(digits)} (expected 14)"],
        )

    century_digit = digits[0]
    gov_code = digits[7:9]
    serial = digits[9:13]
    gender_digit = digits[12]
    check_digit = digits[13]

    century = _CENTURY.get(century_digit)
    if century is None:
        reasons.append(f"century flag '{century_digit}' not in {{2,3,4}}")

    yy = int(digits[1:3])
    mm = int(digits[3:5])
    dd = int(digits[5:7])

    birth_year = century + yy if century is not None else None
    birth_month = mm
    birth_day = dd

    # Validate a real calendar date.
    birth_date = ""
    birth_date_iso = ""
    if birth_year is not None:
        try:
            d = datetime.date(birth_year, mm, dd)
            birth_date = f"{dd:02d}/{mm:02d}/{birth_year}"
            birth_date_iso = d.isoformat()
            if d > datetime.date.today():
                reasons.append(f"birth date {birth_date_iso} is in the future")
        except ValueError as e:
            reasons.append(f"invalid calendar date {birth_year}-{mm:02d}-{dd:02d}: {e}")

    if not is_valid_gov_code(gov_code):
        reasons.append(f"governorate code '{gov_code}' is not officially assigned")

    gender = "Unknown"
    if gender_digit.isdigit():
        gender = "Male" if int(gender_digit) % 2 == 1 else "Female"

    return NidDecode(
        raw=digits,
        structural_ok=(len(reasons) == 0),
        reasons=reasons,
        century_digit=century_digit,
        birth_year=birth_year,
        birth_month=birth_month,
        birth_day=birth_day,
        birth_date=birth_date,
        birth_date_iso=birth_date_iso,
        gov_code=gov_code,
        governorate=governorate_name(gov_code),
        serial=serial,
        gender_digit=gender_digit,
        gender=gender,
        check_digit=check_digit,
    )
