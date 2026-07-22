"""
Egyptian National-ID structural decoder + cross-field validator.

The 14 digits encode (the free deterministic constraints the checksum alone misses):

    d0        century        2 => 1900-1999, 3 => 2000-2099
    d1 d2     year  (YY)
    d3 d4     month (01-12)
    d5 d6     day   (01-31, month-aware)
    d7 d8     governorate code (fixed valid set, incl. 88 = born abroad)
    d9..d12   serial; d12 parity => gender (odd = male, even = female)
    d13       check digit  (see verifier.checksum)

This is the "cross-field consistency" layer the checksum module names as the way
to close its residual single-digit-escape rate. Additive — does not touch
verifier.checksum. References: mahmoudEbeid2/egyptian-national-id; Egyptian NID
governorate code table (CAPMAS).
"""
from __future__ import annotations
from .checksum import is_valid_checksum, _normalize

# Egyptian governorate codes (issuing authority); 88 = born outside Egypt.
VALID_GOV = {
    "01", "02", "03", "04", "11", "12", "13", "14", "15", "16", "17", "18",
    "19", "21", "22", "23", "24", "25", "26", "27", "28", "29", "31", "32",
    "33", "34", "35", "88",
}
_DAYS = {1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
         7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}


def decode(nid: str) -> dict:
    """Return structural fields + per-field validity. Never raises on a 14-digit
    string of digits; callers gate on `structure_ok`."""
    d = _normalize(nid)
    if len(d) != 14:
        return {"ok": False, "reason": f"not 14 digits ({len(d)})"}
    century_ok = d[0] in ("2", "3")
    yy, mm, dd = int(d[1:3]), int(d[3:5]), int(d[5:7])
    gov = d[7:9]
    month_ok = 1 <= mm <= 12
    day_ok = month_ok and 1 <= dd <= _DAYS[mm]
    gov_ok = gov in VALID_GOV
    gender = "male" if int(d[12]) % 2 == 1 else "female"
    return {
        "ok": century_ok and month_ok and day_ok and gov_ok,
        "century_ok": century_ok, "month_ok": month_ok, "day_ok": day_ok,
        "gov_ok": gov_ok, "gov": gov, "gender": gender,
        "birth": f"{'19' if d[0]=='2' else '20'}{d[1:3]}-{d[3:5]}-{d[5:7]}",
    }


def structure_ok(nid: str) -> bool:
    return decode(nid).get("ok", False)


def fully_valid(nid: str, printed_gender: str | None = None) -> bool:
    """All deterministic constraints: checksum AND structure AND (optional)
    agreement with a printed gender ('male'/'female')."""
    if not is_valid_checksum(nid) or not structure_ok(nid):
        return False
    if printed_gender:
        return decode(nid)["gender"] == printed_gender.lower()
    return True
