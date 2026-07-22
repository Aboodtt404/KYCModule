"""
Field comparison + normalisation. Defines what "correct" means per field type.

Correctness is exact match after a type-appropriate normalisation:
  * national_id : Arabic-Indic -> Western, strip non-digits, exact 14-digit match
  * dates       : parse to ISO, exact match (format-agnostic)
  * gender      : map Arabic/English -> {Male,Female}
  * governorate : map Arabic/English/code -> official code, compare codes
  * names/text  : strip tashkeel, normalise alef/ya/ta-marbuta, collapse spaces

For names we ALSO expose a character-error-rate (CER) so the scorecard can show
near-misses, but the headline "name accuracy" is exact normalised match — a KYC
name must be right, not approximately right.
"""

from __future__ import annotations

import re
import unicodedata

_AR2WEST = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_RE_TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]")
_RE_TATWEEL = re.compile(r"ـ")
_RE_WS = re.compile(r"\s+")


def normalize_nid(s: str) -> str:
    return "".join(ch for ch in (s or "").translate(_AR2WEST) if ch.isdigit())


def normalize_arabic(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = _RE_TASHKEEL.sub("", s)
    s = _RE_TATWEEL.sub("", s)
    # unify common variants so transcription nits don't read as errors
    s = (s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
           .replace("ى", "ي").replace("ة", "ه"))
    s = _RE_WS.sub(" ", s).strip()
    return s


def normalize_gender(s: str) -> str:
    if not s:
        return ""
    v = s.strip().lower()
    if v in ("male", "m") or "ذكر" in s:
        return "Male"
    if v in ("female", "f") or "أنثى" in s or "انثى" in s:
        return "Female"
    return v


def normalize_date(s: str) -> str:
    """Return ISO YYYY-MM-DD if parseable, else the raw normalised digits string."""
    if not s:
        return ""
    western = (s or "").translate(_AR2WEST)
    nums = [n for n in re.split(r"[^0-9]+", western) if n]
    if len(nums) == 3:
        a, b, c = nums
        if len(a) == 4:
            y, m, d = a, b, c
        elif len(c) == 4:
            d, m, y = a, b, c
        else:
            return "/".join(nums)
        try:
            import datetime
            return datetime.date(int(y), int(m), int(d)).isoformat()
        except ValueError:
            return "/".join(nums)
    if len(nums) == 2:   # YYYY/MM (issue/expiry sometimes lack a day)
        a, b = nums
        if len(a) == 4:
            return f"{a}-{int(b):02d}" if b.isdigit() else f"{a}/{b}"
        if len(b) == 4:
            return f"{b}-{int(a):02d}"
    return "/".join(nums) if nums else ""


def _gov_code(s: str) -> str:
    from verifier.verifier import _gov_to_code
    code = _gov_to_code(s or "")
    return code or normalize_arabic(s)


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(pred: str, truth: str) -> float:
    """Character error rate of pred vs truth (Arabic-normalised). 0 = perfect."""
    p, t = normalize_arabic(pred), normalize_arabic(truth)
    if not t:
        return 0.0 if not p else 1.0
    return levenshtein(p, t) / max(1, len(t))


def is_correct(field_key: str, pred: str, truth: str) -> bool:
    """Type-aware exact-correctness comparison. Empty truth => cannot judge
    (returns False; the caller treats no-GT samples separately)."""
    if truth is None or truth == "":
        return False
    if field_key == "national_id":
        return normalize_nid(pred) == normalize_nid(truth) and len(normalize_nid(truth)) == 14
    if field_key in ("birth_date", "issue_date", "expiry_date"):
        return normalize_date(pred) == normalize_date(truth)
    if field_key == "gender":
        return normalize_gender(pred) == normalize_gender(truth)
    if field_key == "governorate":
        return _gov_code(pred) == _gov_code(truth)
    # names + generic text
    return normalize_arabic(pred) == normalize_arabic(truth)
