"""mrz.py against the canonical ICAO 9303 sample + repair/date edge cases."""
import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import mrz

# The ICAO Doc 9303 specimen (also the Wikipedia worked example).
L1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
L2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10"


def test_canonical_check_digits():
    assert mrz.check_digit("L898902C3<") == "6"
    assert mrz.check_digit("740812") == "2"
    assert mrz.check_digit("120415") == "9"
    assert mrz.check_digit("ZE184226B<<<<<") == "1"


def test_canonical_parse_all_checks_pass():
    p = mrz.parse_td3(L1, L2)
    assert p["valid_score"] == 1.0
    assert p["surname"] == "ERIKSSON"
    assert p["given_names"] == "ANNA MARIA"
    assert p["document_number"] == "L898902C3"
    assert p["nationality"] == "UTO"
    assert p["birth_date"] == "1974-08-12"
    assert p["expiry_date"] == "2012-04-15"
    assert p["sex"] == "Female"
    assert p["personal_number"] == "ZE184226B"


def test_compose_roundtrip_egyptian_shape():
    l1, l2 = mrz.compose_td3(surname="HASSAN", given_names="MOHAMED AHMED",
                             doc_number="A23456789", birth_yymmdd="980122",
                             sex="M", expiry_yymmdd="310506",
                             personal_number="29801221234567")
    p = mrz.parse_td3(l1, l2)
    assert p["valid_score"] == 1.0
    assert p["issuing_country"] == "EGY"
    assert p["personal_number"] == "29801221234567"
    assert p["birth_date"] == "1998-01-22"
    assert p["expiry_date"] == "2031-05-06"


def test_ocr_confusion_repair_in_numeric_zones():
    # 0->O and 1->I corruption inside DOB + expiry must be repaired
    bad2 = L2.replace("7408122", "74O8I22").replace("1204159", "I2O4I59")
    p = mrz.parse_td3(L1, bad2)
    assert p["checks"]["birth_date"] and p["checks"]["expiry_date"]
    assert p["birth_date"] == "1974-08-12"


def test_corrupted_line_fails_checks_not_crashes():
    p = mrz.parse_td3(L1, L2[:9] + "9" + L2[10:])  # wrong doc check digit
    assert p["checks"]["doc_number"] is False
    assert p["valid_score"] < 1.0


def test_empty_personal_number_is_vacuous():
    l1, l2 = mrz.compose_td3(surname="X", given_names="Y", doc_number="A1",
                             birth_yymmdd="900101", expiry_yymmdd="300101")
    p = mrz.parse_td3(l1, l2)
    assert p["checks"]["personal_number"] is None
    assert p["checks_total"] == 4 and p["valid_score"] == 1.0


def test_guided_repair_doc_number():
    # 8->B misread in the doc number (mixed alnum — blanket translation can't
    # touch it; the check digit CAN see this pair: B=11≡1 vs 8 mod 10).
    bad = L2.replace("L898902C3", "L89B902C3")
    p = mrz.parse_td3(L1, bad)
    assert p["document_number"] == "L898902C3"
    assert p["checks"]["doc_number"] is True
    assert p["checks"]["composite"] is True


def test_mod10_invisible_pairs_stay_untouched():
    # L↔1 swaps are invisible to every check digit (21 ≡ 1 mod 10): the parse
    # must PASS all checks with the wrong char — documenting the ceiling of
    # check-digit repair; issuer format priors are the only fix.
    bad = L2.replace("L898902C3", "1898902C3")
    p = mrz.parse_td3(L1, bad)
    assert p["valid_score"] == 1.0
    assert p["document_number"] == "1898902C3"


def test_repair_never_launders_a_corrupt_check_digit():
    # Field is CORRECT but its check digit got misread: naive repair would
    # mutate the field to satisfy the wrong digit. The composite gate must
    # refuse (no combination validates composite) and leave the line alone.
    bad = L2[:9] + "9" + L2[10:]
    p = mrz.parse_td3(L1, bad)
    assert p["document_number"] == "L898902C3"     # untouched
    assert p["checks"]["doc_number"] is False       # honestly reported
    assert p["checks"]["composite"] is False


def test_date_centuries():
    today = datetime.date(2026, 7, 29)
    assert mrz.mrz_date("300101", today=today) == "1930-01-01"        # birth never future
    assert mrz.mrz_date("300101", expiry=True, today=today) == "2030-01-01"
    assert mrz.mrz_date("980122", today=today) == "1998-01-22"
    assert mrz.mrz_date("981340") == ""                                # bad month/day
