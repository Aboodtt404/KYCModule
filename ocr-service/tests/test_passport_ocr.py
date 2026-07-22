"""
Tests for passport_ocr.py pure functions.
Heavy deps (easyocr, cv2) are stubbed so these run without GPU or model downloads.
"""
import sys
import types

# ── stub heavy dependencies before import ────────────────────────────────────
for mod in ("cv2", "easyocr", "numpy"):
    if mod not in sys.modules:
        stub = types.ModuleType(mod)
        if mod == "numpy":
            stub.ndarray = object
            stub.array = lambda *a, **kw: None
        sys.modules[mod] = stub

from passport_ocr import _mrz_date, _mrz_name, _parse_td3  # noqa: E402


# ── _mrz_date ────────────────────────────────────────────────────────────────

class TestMrzDate:
    def test_2000s_dob(self):
        # yy=01 → 2001
        assert _mrz_date("010315") == "15/03/2001"

    def test_1900s_dob(self):
        # yy=75 → 1975
        assert _mrz_date("750820") == "20/08/1975"

    def test_boundary_year_30(self):
        # yy=30 → 2030 (boundary: <= 30 → 2000s)
        assert _mrz_date("300101") == "01/01/2030"

    def test_boundary_year_31(self):
        # yy=31 → 1931
        assert _mrz_date("310101") == "01/01/1931"

    def test_zero_padded_day_month(self):
        assert _mrz_date("950102") == "02/01/1995"

    def test_invalid_returns_raw(self):
        # Too short — should return original string, not crash
        result = _mrz_date("XXXXXX")
        assert isinstance(result, str)


# ── _mrz_name ────────────────────────────────────────────────────────────────

class TestMrzName:
    def test_simple_name(self):
        first, second, full = _mrz_name("SMITH<<JOHN<")
        assert first == "JOHN"
        assert second == ""
        assert "JOHN" in full
        assert "SMITH" in full

    def test_name_with_second_given(self):
        first, second, full = _mrz_name("HASSAN<<AHMED<IBRAHIM<")
        assert first == "AHMED"
        assert second == "IBRAHIM"

    def test_no_given_name(self):
        first, second, full = _mrz_name("NOUR<<")
        assert first == ""
        assert "NOUR" in full

    def test_filler_brackets_stripped(self):
        # '<' should be replaced with spaces, not kept
        first, second, full = _mrz_name("IBRAHIM<<ALI<HASSAN<<")
        assert "<" not in full


# ── _parse_td3 ───────────────────────────────────────────────────────────────

class TestParseTd3:
    # Real-looking (synthetic) Egyptian passport MRZ
    LINE1 = "P<EGYHASSAN<<AHMED<IBRAHIM<<<<<<<<<<<<<<<<"
    LINE2 = "A12345678<EGY9501011M3001015<<<<<<<<<<<<<<2"

    def test_doc_type(self):
        result = _parse_td3(self.LINE1, self.LINE2)
        assert result["doc_type"] == "P"

    def test_nationality(self):
        result = _parse_td3(self.LINE1, self.LINE2)
        assert result["nationality"] == "EGY"

    def test_document_number(self):
        result = _parse_td3(self.LINE1, self.LINE2)
        assert result["document_number"] == "A12345678"

    def test_birth_date_parsed(self):
        result = _parse_td3(self.LINE1, self.LINE2)
        assert result["birth_date"] == "01/01/1995"  # 950101

    def test_expiry_date_parsed(self):
        result = _parse_td3(self.LINE1, self.LINE2)
        assert result["expiry_date"] == "01/01/2030"  # 300101

    def test_gender_male(self):
        result = _parse_td3(self.LINE1, self.LINE2)
        assert result["gender"] == "Male"

    def test_gender_female(self):
        line2 = self.LINE2[:20] + "F" + self.LINE2[21:]
        result = _parse_td3(self.LINE1, line2)
        assert result["gender"] == "Female"

    def test_gender_unknown(self):
        line2 = self.LINE2[:20] + "X" + self.LINE2[21:]
        result = _parse_td3(self.LINE1, line2)
        assert result["gender"] == "Unknown"

    def test_full_name_contains_surname(self):
        result = _parse_td3(self.LINE1, self.LINE2)
        assert "HASSAN" in result["full_name"]

    def test_short_lines_padded(self):
        # Lines shorter than 44 chars should not crash (padded with '<')
        result = _parse_td3("P<EGYFOO<<BAR", "A1234567")
        assert isinstance(result, dict)
        assert "doc_type" in result
