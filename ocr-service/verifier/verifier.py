"""
NIDVerifier — turns the checksum + internal structure + cross-field agreement
into a per-field pass/fail report and a calibrated ACCEPT / ABSTAIN / REJECT
verdict.

This is the runtime guard AND the scoring oracle of the methodology. The
governing principle (plan §3): the system must be RIGHT or KNOW it isn't and
abstain. So:

  * Any deterministic contradiction (bad format, failed checksum, impossible
    date/gov, decoded field disagreeing with the OCR'd field, front NID != back
    NID) => REJECT. A wrong number is caught, not emitted.
  * All hard checks pass + strong OCR confidence => ACCEPT.
  * All hard checks pass but weak/insufficient confidence => ABSTAIN (re-scan),
    because names are not checksum-protected and a low-confidence read is not
    worth a confident save.

`score` is the model's P(extraction correct). The mapping from score to a
decision threshold is *calibrated by the harness* against ground truth (a
reliability curve); the verifier exposes a sensible default threshold that the
harness can tune. The harness, not the verifier, owns the empirical calibration.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum

from .checksum import is_valid_checksum, check_digit, CHECKSUM_ALGORITHM
from .decode import decode_nid, NidDecode, to_western_digits
from .governorates import GOVERNORATES, governorate_name


class Verdict(str, Enum):
    ACCEPT = "ACCEPT"
    ABSTAIN = "ABSTAIN"
    REJECT = "REJECT"


@dataclass
class FieldCheck:
    name: str
    # True = passed, False = failed (a contradiction), None = not applicable
    # (the corresponding evidence was not provided).
    passed: bool | None
    detail: str = ""

    @property
    def is_failure(self) -> bool:
        return self.passed is False


@dataclass
class VerifierResult:
    nid: str                         # normalised 14-digit (or whatever was given)
    verdict: Verdict
    score: float                     # P(extraction correct) in [0, 1]
    checks: list[FieldCheck] = field(default_factory=list)
    decode: NidDecode | None = None
    reasons: list[str] = field(default_factory=list)
    algorithm: str = CHECKSUM_ALGORITHM

    @property
    def checksum_valid(self) -> bool:
        return any(c.name == "checksum" and c.passed for c in self.checks)

    @property
    def hard_failures(self) -> list[FieldCheck]:
        return [c for c in self.checks if c.is_failure]

    def to_dict(self) -> dict:
        return {
            "nid": self.nid,
            "verdict": self.verdict.value,
            "score": round(self.score, 4),
            "checksum_valid": self.checksum_valid,
            "checks": [
                {"name": c.name, "passed": c.passed, "detail": c.detail}
                for c in self.checks
            ],
            "decode": {
                "birth_date": self.decode.birth_date if self.decode else "",
                "gender": self.decode.gender if self.decode else "Unknown",
                "governorate": self.decode.governorate if self.decode else "Unknown",
                "structural_ok": self.decode.structural_ok if self.decode else False,
            },
            "reasons": self.reasons,
            "algorithm": self.algorithm,
        }


# ---- governorate normalisation (OCR gov may be Arabic, English, or a code) ---

# Arabic governorate names -> official 2-digit code, so an OCR'd Arabic gov can
# be compared against the code decoded from the NID.
_AR_GOV_TO_CODE = {
    "القاهرة": "01", "الاسكندرية": "02", "الإسكندرية": "02", "بورسعيد": "03",
    "بور سعيد": "03", "السويس": "04", "دمياط": "11", "الدقهلية": "12",
    "الشرقية": "13", "القليوبية": "14", "كفرالشيخ": "15", "كفر الشيخ": "15",
    "الغربية": "16", "المنوفية": "17", "البحيرة": "18", "الاسماعيلية": "19",
    "الإسماعيلية": "19", "الجيزة": "21", "بنيسويف": "22", "بني سويف": "22",
    "الفيوم": "23", "المنيا": "24", "اسيوط": "25", "أسيوط": "25", "سوهاج": "26",
    "قنا": "27", "اسوان": "28", "أسوان": "28", "الاقصر": "29", "الأقصر": "29",
    "البحرالاحمر": "31", "البحر الأحمر": "31", "الواديالجديد": "32",
    "الوادي الجديد": "32", "مطروح": "33", "شمالسيناء": "34", "شمال سيناء": "34",
    "جنوبسيناء": "35", "جنوب سيناء": "35",
}
_EN_GOV_TO_CODE = {v.lower(): k for k, v in GOVERNORATES.items()}


def _gov_to_code(value: str) -> str | None:
    """Best-effort map an OCR'd governorate (Arabic name / English name / code)
    to its official 2-digit code, or None if unrecognised."""
    if not value:
        return None
    v = value.strip()
    digits = to_western_digits(v)
    if len(digits) == 2 and digits in GOVERNORATES:
        return digits
    # strip tashkeel + collapse whitespace for Arabic matching
    v_ar = re.sub(r"[ً-ٰٟ]", "", v)
    v_ar_nospace = re.sub(r"\s+", "", v_ar)
    if v_ar in _AR_GOV_TO_CODE:
        return _AR_GOV_TO_CODE[v_ar]
    if v_ar_nospace in {re.sub(r"\s+", "", k): c for k, c in _AR_GOV_TO_CODE.items()}:
        return {re.sub(r"\s+", "", k): c for k, c in _AR_GOV_TO_CODE.items()}[v_ar_nospace]
    if v.lower() in _EN_GOV_TO_CODE:
        return _EN_GOV_TO_CODE[v.lower()]
    return None


def _norm_gender(value: str) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    if v in ("male", "m") or "ذكر" in value:
        return "Male"
    if v in ("female", "f") or "أنثى" in value or "انثى" in value:
        return "Female"
    return None


def _norm_date(value: str) -> str | None:
    """Normalise a date string to ISO YYYY-MM-DD, or None if unparseable.
    Accepts DD/MM/YYYY, YYYY/MM/DD, with / - . separators and Arabic-Indic."""
    if not value:
        return None
    s = "".join(c if c.isdigit() else ("/" if c in "/-." else " ")
                for c in to_western_digits_keep_sep(value))
    nums = [n for n in re.split(r"[^0-9]+", s) if n]
    if len(nums) != 3:
        return None
    a, b, c = nums
    if len(a) == 4:            # YYYY/MM/DD
        y, m, d = a, b, c
    elif len(c) == 4:          # DD/MM/YYYY
        d, m, y = a, b, c
    else:
        return None
    try:
        import datetime
        return datetime.date(int(y), int(m), int(d)).isoformat()
    except ValueError:
        return None


_AR2WEST = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def to_western_digits_keep_sep(s: str) -> str:
    return s.translate(_AR2WEST)


class NIDVerifier:
    """The verifier. Stateless; thread-safe; deterministic.

    accept_threshold: minimum `score` for an ACCEPT when all hard checks pass.
                      Below it (but with hard checks passing) the verdict is
                      ABSTAIN. The harness calibrates this against ground truth.
    """

    def __init__(self, accept_threshold: float = 0.90):
        self.accept_threshold = accept_threshold

    def verify(
        self,
        nid: str,
        ocr_fields: dict | None = None,
        back_nid: str | None = None,
        field_confidences: dict | None = None,
        ocr_confidence: float | None = None,
    ) -> VerifierResult:
        """Verify a read NID against the checksum, its own structure, the OCR'd
        fields (cross-field consistency), and the back NID (front==back).

        nid                : the read front NID (or back NID if back-only).
        ocr_fields         : optional {'birth_date'|'dob', 'gender', 'governorate'}
                             as independently OCR'd from the card face.
        back_nid           : optional NID read from the other side, for front==back.
        field_confidences  : optional {field_name: conf in [0,1]} from the OCR model.
        ocr_confidence     : optional single overall OCR confidence for the NID.
        """
        ocr_fields = ocr_fields or {}
        field_confidences = field_confidences or {}
        checks: list[FieldCheck] = []
        reasons: list[str] = []

        digits = to_western_digits(nid)
        dec = decode_nid(digits)

        # 1. Format
        fmt_ok = len(digits) == 14
        checks.append(FieldCheck(
            "format", fmt_ok,
            f"{len(digits)} digits" + ("" if fmt_ok else " (expected 14)")))
        if not fmt_ok:
            reasons.append(f"format: {len(digits)} digits, expected 14")

        # 2. Checksum (the oracle) — only meaningful at 14 digits
        if fmt_ok:
            cs_ok = is_valid_checksum(digits)
            if cs_ok:
                detail = "check digit matches"
            else:
                try:
                    exp = check_digit(digits[:13])
                    detail = f"check digit {digits[13]} != expected {exp}"
                except ValueError:
                    detail = "could not compute expected check digit"
            checks.append(FieldCheck("checksum", cs_ok, detail))
            if not cs_ok:
                reasons.append(f"checksum: {detail}")
        else:
            checks.append(FieldCheck("checksum", None, "n/a (bad format)"))

        # 3. Structural decode (real calendar date, assigned gov, century flag)
        struct_ok = dec.structural_ok if fmt_ok else False
        checks.append(FieldCheck(
            "structure", struct_ok if fmt_ok else None,
            "; ".join(dec.reasons) if dec.reasons else "all components in range"))
        if fmt_ok and not struct_ok:
            reasons.extend(f"structure: {r}" for r in dec.reasons)

        # 4. Cross-field: decoded DOB == OCR'd DOB
        ocr_dob = ocr_fields.get("birth_date") or ocr_fields.get("dob")
        if ocr_dob and dec.birth_date_iso:
            got = _norm_date(ocr_dob)
            ok = (got is not None and got == dec.birth_date_iso)
            checks.append(FieldCheck(
                "dob_match", ok,
                f"decoded {dec.birth_date_iso} vs OCR {got or ocr_dob!r}"))
            if not ok:
                reasons.append(f"dob_match: NID says {dec.birth_date_iso}, OCR says {got or ocr_dob!r}")
        else:
            checks.append(FieldCheck("dob_match", None, "no OCR DOB to compare"))

        # 5. Cross-field: decoded gender == OCR'd gender
        ocr_gender = _norm_gender(ocr_fields.get("gender", ""))
        if ocr_gender and dec.gender != "Unknown":
            ok = (ocr_gender == dec.gender)
            checks.append(FieldCheck(
                "gender_match", ok, f"decoded {dec.gender} vs OCR {ocr_gender}"))
            if not ok:
                reasons.append(f"gender_match: NID says {dec.gender}, OCR says {ocr_gender}")
        else:
            checks.append(FieldCheck("gender_match", None, "no OCR gender to compare"))

        # 6. Cross-field: decoded governorate == OCR'd governorate
        ocr_gov_raw = ocr_fields.get("governorate", "")
        ocr_gov_code = _gov_to_code(ocr_gov_raw)
        if ocr_gov_code and dec.gov_code:
            ok = (ocr_gov_code == dec.gov_code)
            checks.append(FieldCheck(
                "gov_match", ok,
                f"decoded {dec.gov_code}/{dec.governorate} vs OCR "
                f"{ocr_gov_code}/{governorate_name(ocr_gov_code)}"))
            if not ok:
                reasons.append(
                    f"gov_match: NID says {dec.gov_code}, OCR says {ocr_gov_code}")
        else:
            checks.append(FieldCheck("gov_match", None, "no recognisable OCR governorate"))

        # 7. front NID == back NID
        if back_nid:
            back_digits = to_western_digits(back_nid)
            ok = (back_digits == digits and len(digits) == 14)
            checks.append(FieldCheck(
                "front_back_match", ok,
                f"front {digits} vs back {back_digits}"))
            if not ok:
                reasons.append(f"front_back_match: front {digits} != back {back_digits}")
        else:
            checks.append(FieldCheck("front_back_match", None, "no back NID provided"))

        verdict, score = self._decide(checks, field_confidences, ocr_confidence)
        return VerifierResult(
            nid=digits, verdict=verdict, score=score,
            checks=checks, decode=dec, reasons=reasons)

    def _decide(self, checks, field_confidences, ocr_confidence) -> tuple[Verdict, float]:
        """Combine the deterministic checks with OCR confidence into a verdict
        and a calibrated score (P(correct))."""
        # Any deterministic contradiction => REJECT (the wrong number is caught).
        if any(c.is_failure for c in checks):
            return Verdict.REJECT, 0.0

        # The mandatory hard gate is the checksum (when format allowed it).
        cs = next((c for c in checks if c.name == "checksum"), None)
        if cs is None or cs.passed is not True:
            # No valid checksum could be computed (bad format) => REJECT.
            return Verdict.REJECT, 0.0

        # All hard checks passed. Build the score from evidence:
        #   start from the OCR confidence (the weakest link), then let each
        #   passed independent cross-check pull the score up toward 1.
        if ocr_confidence is not None:
            base = float(ocr_confidence)
        elif field_confidences:
            base = float(min(field_confidences.values()))
        else:
            # No confidence supplied: a passing checksum alone is strong (random
            # 14-digit strings pass ~1/11 of the time) but names are unverified.
            base = 0.82

        corroborations = sum(
            1 for c in checks
            if c.name in ("dob_match", "gender_match", "gov_match", "front_back_match")
            and c.passed is True)
        # Each independent corroboration closes part of the remaining gap to 1.
        score = base
        for _ in range(corroborations):
            score = score + (1.0 - score) * 0.5
        score = max(0.0, min(1.0, score))

        verdict = Verdict.ACCEPT if score >= self.accept_threshold else Verdict.ABSTAIN
        return verdict, score
