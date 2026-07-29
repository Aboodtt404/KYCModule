"""ICAO 9303 TD3 (passport) MRZ: compose, parse, validate, repair.

Pure logic, no OCR — the deterministic layer that turns two 44-char lines into
fields with an evidence-backed verdict, exactly the role detfirst_rules'
checksum plays for the national ID. The MRZ carries FIVE check digits
(document number, birth date, expiry date, personal number, and a composite
over most of line 2): a parse that passes all five is cryptographically weak
but combinatorially strong evidence the OCR read is correct.

Layout (TD3, 2 lines x 44):
  L1: P<CCC SURNAME<<GIVEN<NAMES<<<<...            [0]=P [2:5]=issuer [5:]=names
  L2: NNNNNNNNNcCCCYYMMDDcSYYMMDDcPPPPPPPPPPPPPPcX
      [0:9]=doc# [9]=cd [10:13]=nationality [13:19]=DOB [19]=cd [20]=sex
      [21:27]=expiry [27]=cd [28:42]=personal# [42]=cd(personal, may be <)
      [43]=composite cd over [0:10]+[13:20]+[21:43]
"""
from __future__ import annotations

import datetime
import re

_WEIGHTS = (7, 3, 1)


def char_value(ch: str) -> int:
    if ch == "<":
        return 0
    if ch.isdigit():
        return int(ch)
    if "A" <= ch <= "Z":
        return ord(ch) - ord("A") + 10
    raise ValueError(f"invalid MRZ char {ch!r}")


def check_digit(field: str) -> str:
    total = sum(char_value(c) * _WEIGHTS[i % 3] for i, c in enumerate(field))
    return str(total % 10)


def _composite_input(l2: str) -> str:
    return l2[0:10] + l2[13:20] + l2[21:43]


# ── field-aware OCR repair ───────────────────────────────────────────────────
# OCR-B confusions run both ways; which direction is right depends on whether
# the field is alphabetic or numeric. Applied BEFORE check-digit verification.
_TO_DIGIT = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1",
                           "Z": "2", "S": "5", "B": "8", "G": "6", "T": "7"})
_TO_ALPHA = str.maketrans({"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"})

# Bidirectional confusion sets for check-digit-GUIDED repair of mixed
# alphanumeric fields (doc number): each char's plausible misread alternatives.
# ONLY pairs the 7-3-1 mod-10 scheme can actually SEE are listed: char values
# collide mod 10 for L(21)≡1, B(11)≡1... no wait B is listed — B=11≡1 vs 8:
# 11 vs 8 differ. The truly INVISIBLE pairs are L↔1 (21≡1) and G↔6 (16≡6):
# swapping them changes no check digit anywhere, so they are omitted — no
# search can justify them; only issuer format priors can (see _egy_priors).
_CONFUSION = {
    "0": "OD", "O": "0", "D": "0", "Q": "0",
    "1": "I", "I": "1",
    "2": "Z", "Z": "2",
    "4": "A", "A": "4",
    "5": "S", "S": "5",
    "7": "T", "T": "7",
    "8": "B", "B": "8",
}


def repair_candidates(field: str, cd: str, max_subs: int = 2, cap: int = 8) -> list[str]:
    """All minimal confusion-set substitutions (≤max_subs) that make
    check_digit(field) == cd. Candidates alone are NOT trusted — a misread
    check digit would launder a wrong 'repair' — the caller must gate the
    final line on the COMPOSITE check digit."""
    if not re.fullmatch(r"\d", cd or ""):
        return []
    from itertools import combinations, product
    pos_opts = [(i, _CONFUSION[c]) for i, c in enumerate(field) if c in _CONFUSION]
    for k in range(1, max_subs + 1):
        found = []
        for combo in combinations(pos_opts, k):
            idxs = [i for i, _ in combo]
            for repl in product(*[alts for _, alts in combo]):
                cand = list(field)
                for i, r in zip(idxs, repl):
                    cand[i] = r
                cand = "".join(cand)
                if check_digit(cand) == cd:
                    found.append(cand)
        uniq = sorted(set(found))
        if uniq:
            return uniq[:cap]
    return []


_L2_FIELDS = ((0, 9, 9), (13, 19, 19), (21, 27, 27), (28, 42, 42))


def _repair_l2(l2: str) -> str:
    """Composite-gated repair: for every field failing its own check digit,
    enumerate candidate fixes; accept the smallest set of fixes under which
    the COMPOSITE check digit validates. No combination validating composite
    -> return the line untouched (report failure honestly, never guess)."""
    failing = [(s, e, c) for s, e, c in _L2_FIELDS if check_digit(l2[s:e]) != l2[c]]
    if not failing:
        return l2
    from itertools import product
    options = []
    for s, e, c in failing:
        cands = repair_candidates(l2[s:e], l2[c])
        options.append([(s, e, None)] + [(s, e, f) for f in cands])
    best = None
    for combo in product(*options):
        cand = l2
        for s, e, f in combo:
            if f is not None:
                cand = cand[:s] + f + cand[e:]
        if check_digit(_composite_input(cand)) == cand[43]:
            n_fixed = sum(1 for _, _, f in combo if f is not None)
            if n_fixed and (best is None or n_fixed < best[1]):
                best = (cand, n_fixed)
    return best[0] if best else l2


def _digits(s: str) -> str:
    return s.translate(_TO_DIGIT)


def _alpha(s: str) -> str:
    return s.translate(_TO_ALPHA)


def mrz_date(s: str, *, expiry: bool = False, today: datetime.date | None = None) -> str:
    """YYMMDD -> ISO YYYY-MM-DD with the century resolved.
    Birth dates: never in the future (2026 reading '30' means 1930).
    Expiry dates: passports live <= 10-15 years, so a window around now."""
    s = _digits(s)
    if not re.fullmatch(r"\d{6}", s):
        return ""
    yy, mm, dd = int(s[:2]), int(s[2:4]), int(s[4:6])
    if not (1 <= mm <= 12 and 1 <= dd <= 31):
        return ""
    today = today or datetime.date.today()
    if expiry:
        # expiry can only be near-past or future: pick the century that lands
        # within [today-20y, today+20y]
        year = 2000 + yy
        if year > today.year + 20:
            year -= 100
        elif year < today.year - 20:
            year += 100
    else:
        year = 2000 + yy
        if year > today.year:  # birth dates are never in the future
            year -= 100
    try:
        datetime.date(year, mm, dd)
    except ValueError:
        return ""
    return f"{year:04d}-{mm:02d}-{dd:02d}"


def parse_name(field: str) -> dict:
    field = field.rstrip("<")
    primary, _, secondary = field.partition("<<")
    surname = primary.replace("<", " ").strip()
    given = secondary.replace("<", " ").strip()
    return {"surname": surname, "given_names": given,
            "full_name": f"{given} {surname}".strip()}


def parse_td3(line1: str, line2: str) -> dict:
    """Parse + validate a TD3 pair. Never raises on content; returns a dict:
      fields..., checks: {doc_number, birth_date, expiry_date, personal_number,
      composite: bool|None}, checks_passed, checks_total, valid_score 0..1.
    Field-aware repair is applied to numeric zones before validation.
    """
    l1 = (line1.upper() + "<" * 44)[:44]
    l2 = (line2.upper() + "<" * 44)[:44]
    # normalize anything non-MRZ to filler
    l1 = re.sub(r"[^A-Z0-9<]", "<", l1)
    l2 = re.sub(r"[^A-Z0-9<]", "<", l2)

    # numeric zones: DOB, expiry, and the FOUR check digit positions
    l2 = (l2[:13] + _digits(l2[13:19]) + _digits(l2[19]) + l2[20]
          + _digits(l2[21:27]) + _digits(l2[27]) + l2[28:42]
          + l2[42] + _digits(l2[43]))
    # alpha zones: issuer + nationality
    l1 = l1[:2] + _alpha(l1[2:5]) + l1[5:]
    l2 = l2[:10] + _alpha(l2[10:13]) + l2[13:]
    # doc-number check digit
    l2 = l2[:9] + (_digits(l2[9]) if l2[9] != "<" else "0") + l2[10:]

    # Composite-gated guided repair (doc number is the main beneficiary —
    # mixed alnum, so blanket translation can't touch it; A<->4 flips only
    # when both the field check digit AND the composite endorse it).
    l2 = _repair_l2(l2)

    doc_number = l2[0:9].rstrip("<")
    checks = {
        "doc_number": check_digit(l2[0:9]) == l2[9],
        "birth_date": check_digit(l2[13:19]) == l2[19],
        "expiry_date": check_digit(l2[21:27]) == l2[27],
    }
    personal_raw = l2[28:42]
    personal = personal_raw.rstrip("<")
    if personal or l2[42] not in "<0":
        checks["personal_number"] = check_digit(personal_raw) == _digits(l2[42])
    else:
        checks["personal_number"] = None  # empty field, cd may be < or 0 — vacuous
    checks["composite"] = check_digit(_composite_input(l2)) == l2[43]

    applicable = [v for v in checks.values() if v is not None]
    passed = sum(1 for v in applicable if v)

    name = parse_name(l1[5:44])
    sex = {"M": "Male", "F": "Female"}.get(l2[20], "Unknown")
    return {
        "doc_type": l1[0],
        "issuing_country": l1[2:5].replace("<", ""),
        "surname": name["surname"],
        "given_names": name["given_names"],
        "full_name": name["full_name"],
        "document_number": doc_number,
        "nationality": l2[10:13].replace("<", ""),
        "birth_date": mrz_date(l2[13:19]),
        "sex": sex,
        "expiry_date": mrz_date(l2[21:27], expiry=True),
        "personal_number": personal,
        "checks": checks,
        "checks_passed": passed,
        "checks_total": len(applicable),
        "valid_score": passed / len(applicable) if applicable else 0.0,
        "line1": l1,
        "line2": l2,
    }


def compose_td3(*, surname: str, given_names: str, doc_number: str,
                country: str = "EGY", nationality: str = "EGY",
                birth_yymmdd: str = "", sex: str = "M",
                expiry_yymmdd: str = "", personal_number: str = "") -> tuple[str, str]:
    """Build a VALID TD3 pair (test fixtures / synthetic renders)."""
    names = f"{surname.upper().replace(' ', '<')}<<{given_names.upper().replace(' ', '<')}"
    l1 = ("P<" + country.upper() + names).ljust(44, "<")[:44]
    doc = doc_number.upper().ljust(9, "<")[:9]
    pers = personal_number.upper().ljust(14, "<")[:14]
    l2 = (doc + check_digit(doc) + nationality.upper()
          + birth_yymmdd + check_digit(birth_yymmdd) + sex
          + expiry_yymmdd + check_digit(expiry_yymmdd)
          + pers + check_digit(pers))
    l2 += check_digit(_composite_input(l2 + "0"))
    return l1, l2
