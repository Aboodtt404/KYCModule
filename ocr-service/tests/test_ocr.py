"""
Unit tests for pure text-processing functions in server.py.

Heavy ML dependencies (easyocr, ultralytics, deepface, cv2) are stubbed out
before server is imported, so these tests run fast with no GPU/model files.
"""

import sys
import types
from unittest.mock import MagicMock

# ── Stub heavy optional dependencies ────────────────────────────────────────
# Must happen before `import server`; module-level code in server.py calls
# _load_yolo_models() and creates a Flask app, both of which need these stubs.
_STUBS = [
    "easyocr",
    "ultralytics",
    "deepface",
    "cv2",
    "PIL",
    "PIL.Image",
    "flask",
    "flask.globals",
    "flask_cors",
    "flask_limiter",
    "flask_limiter.util",
]
for _mod in _STUBS:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

import importlib, pathlib, numpy as np  # noqa: E402

# server.py lives one directory above this test file
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import server  # noqa: E402


# ── _clean_arabic ────────────────────────────────────────────────────────────

class TestCleanArabic:
    def test_no_change_for_plain_arabic(self):
        assert server._clean_arabic("محمد أحمد") == "محمد أحمد"

    def test_strips_fathah(self):
        # U+064E FATHAH is in the harakat range
        assert server._clean_arabic("مُحَمَّد") == "محمد"

    def test_strips_shadda_and_sukun(self):
        # U+0651 SHADDA falls within the harakat range and is also stripped
        assert server._clean_arabic("عَبْدُاللّه") == "عبدالله"

    def test_collapses_extra_whitespace(self):
        assert server._clean_arabic("محمد   أحمد") == "محمد أحمد"

    def test_strips_leading_trailing_whitespace(self):
        assert server._clean_arabic("  محمد  ") == "محمد"

    def test_empty_string(self):
        assert server._clean_arabic("") == ""

    def test_latin_text_unchanged(self):
        assert server._clean_arabic("John Doe") == "John Doe"


# ── _DIGIT_FIX ───────────────────────────────────────────────────────────────

class TestDigitFix:
    def _fix(self, s: str) -> str:
        return s.translate(server._DIGIT_FIX)

    def test_O_to_0(self):
        assert self._fix("O") == "0"

    def test_lowercase_o_to_0(self):
        assert self._fix("o") == "0"

    def test_Q_to_0(self):
        assert self._fix("Q") == "0"

    def test_I_to_1(self):
        assert self._fix("I") == "1"

    def test_lowercase_l_to_1(self):
        assert self._fix("l") == "1"

    def test_pipe_to_1(self):
        assert self._fix("|") == "1"

    def test_Z_to_2(self):
        assert self._fix("Z") == "2"

    def test_S_to_5(self):
        assert self._fix("S") == "5"

    def test_G_to_6(self):
        assert self._fix("G") == "6"

    def test_T_to_7(self):
        assert self._fix("T") == "7"

    def test_B_to_8(self):
        assert self._fix("B") == "8"

    def test_g_to_9(self):
        assert self._fix("g") == "9"

    def test_real_digits_unchanged(self):
        assert self._fix("0123456789") == "0123456789"

    def test_mixed_string(self):
        assert self._fix("2991230I234567") == "29912301234567"


# ── _national_id ─────────────────────────────────────────────────────────────

class TestNationalId:
    def test_plain_14_digit_starting_2(self):
        assert server._national_id(["29901010112345"]) == "29901010112345"

    def test_plain_14_digit_starting_3(self):
        assert server._national_id(["30001011234567"]) == "30001011234567"

    def test_nid_embedded_in_text(self):
        assert server._national_id(["الرقم 29901010112345 بطاقة"]) == "29901010112345"

    def test_nid_split_across_ocr_lines(self):
        # OCR sometimes splits the number across words
        result = server._national_id(["2990101", "0112345"])
        assert result == "29901010112345"

    def test_digit_fix_applied_for_I(self):
        # I → 1 via _DIGIT_FIX
        assert server._national_id(["2990I010112345"]) == "29901010112345"

    def test_digit_fix_applied_for_O(self):
        # O → 0
        assert server._national_id(["2990101O112345"]) == "29901010112345"

    def test_returns_none_for_no_match(self):
        assert server._national_id(["hello world"]) is None

    def test_returns_none_for_wrong_length(self):
        assert server._national_id(["2990101011234"]) is None  # 13 digits only

    def test_invalid_start_digit(self):
        # Must start with 2 or 3
        assert server._national_id(["19901010112345"]) is None

    def test_empty_list(self):
        assert server._national_id([]) is None


# ── _derive ──────────────────────────────────────────────────────────────────

class TestDerive:
    def test_cairo_female_1999(self):
        # NID: century=2→19, yy=99, mm=01, dd=01, gov=01→Cairo, seq=1234→even→Female
        result = server._derive("29901010112345")
        assert result["birth_date"] == "01/01/1999"
        assert result["gender"] == "Female"
        assert result["governorate"] == "Cairo"

    def test_century_20_for_nid_starting_3(self):
        # NID: century=3→20, yy=00, mm=01, dd=01, gov=12→Dakahlia, seq=3456→even→Female
        result = server._derive("30001011234567")
        assert result["birth_date"] == "01/01/2000"
        assert result["governorate"] == "Dakahlia"

    def test_male_gender_odd_sequence(self):
        # seq=1235 → odd → Male
        result = server._derive("29901010112351")
        assert result["gender"] == "Male"

    def test_female_gender_even_sequence(self):
        result = server._derive("29901010112340")
        assert result["gender"] == "Female"

    def test_unknown_governorate_for_unmapped_code(self):
        # gov code '99' not in _GOV
        result = server._derive("29901019912345")
        assert result["governorate"] == "Unknown"

    def test_known_governorates(self):
        known = [
            ("01", "Cairo"), ("02", "Alexandria"), ("21", "Giza"),
            ("28", "Aswan"), ("88", "Foreign"),
        ]
        for code, name in known:
            # NID layout: 2(century) + 99(yy) + 01(mm) + 00(dd) + code(gov) + 1234(seq) + 5(check) = 14 chars
            nid = f"2990100{code}12345"
            assert server._derive(nid)["governorate"] == name, f"code={code}"

    def test_birth_date_format(self):
        # NID: 2(century19) + 95(yy) + 12(mm) + 10(dd) + 11(gov=Damietta) + 1234(seq) + 5(check)
        # Expect DD/MM/YYYY → 10/12/1995
        result = server._derive("29512101112345")
        assert result["birth_date"] == "10/12/1995"


# ── _arabic_name ─────────────────────────────────────────────────────────────

class TestArabicName:
    def test_single_line_arabic_name(self):
        first, second, full = server._arabic_name(["محمد أحمد عبدالله"])
        assert first == "محمد"
        assert second == "أحمد"
        assert full == "محمد أحمد عبدالله"

    def test_skips_header_lines(self):
        lines = ["جمهورية مصر العربية", "بطاقة تحقيق الشخصية", "محمد أحمد علي"]
        first, second, full = server._arabic_name(lines)
        assert full == "محمد أحمد علي"

    def test_skips_lines_with_digits(self):
        lines = ["29901010112345", "فاطمة علي حسن"]
        _, _, full = server._arabic_name(lines)
        assert full == "فاطمة علي حسن"

    def test_returns_empty_strings_when_no_name_found(self):
        first, second, full = server._arabic_name(["hello", "world", "123"])
        assert first == "" and second == "" and full == ""

    def test_short_lines_skipped(self):
        # Lines of ≤3 chars are skipped
        lines = ["مص", "محمد أحمد"]
        _, _, full = server._arabic_name(lines)
        assert full == "محمد أحمد"


# ── _address ─────────────────────────────────────────────────────────────────

class TestAddress:
    def test_extracts_address_after_label(self):
        lines = ["العنوان 15 شارع النيل القاهرة"]
        result = server._address(lines)
        assert "15 شارع النيل القاهرة" in result

    def test_extracts_address_by_content_keyword(self):
        lines = ["شارع الجمهورية"]
        result = server._address(lines)
        assert "شارع الجمهورية" in result

    def test_extracts_multi_line_address(self):
        lines = ["العنوان", "15 شارع النيل", "حي الزيتون"]
        result = server._address(lines)
        assert "15 شارع النيل" in result
        assert "حي الزيتون" in result

    def test_returns_empty_for_no_address(self):
        result = server._address(["محمد أحمد", "29901010112345"])
        assert result == ""

    def test_address_label_with_colon(self):
        lines = ["العنوان: 7 شارع المعز"]
        result = server._address(lines)
        assert "7 شارع المعز" in result

    def test_stops_after_two_lines(self):
        lines = ["العنوان", "line1", "line2", "line3", "line4"]
        result = server._address(lines)
        parts = [p.strip() for p in result.split("،") if p.strip()]
        assert len(parts) <= 2
