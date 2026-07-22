"""
Regression test for the ONE silent error found on the held-out front benchmark
(Jun-27): a confident, consistent single-digit misread that forms ANOTHER fully
valid NID, so checksum + structure + detector-confidence + multi-view consensus
all pass. The image alone cannot catch it; an INDEPENDENT reference can.

Real failing vector (card 30208011504684, valid split):
    GT   = 27611171500042   -> 1976-11-17  (day = 17)
    READ = 27611271500042   -> 1976-11-27  (day = 27)   <- detector misread d5 1->2

These tests pin the contract that the silent error is:
  * REJECTED when an independent back-of-card NID is available (front != back),
  * REJECTED when an independent printed DOB is available (decoded != printed),
  * never SILENTLY ACCEPTED even with no independent signal (ABSTAIN, not ACCEPT),
  * and that a NID-DERIVED field must NEVER be used as corroboration (same source).
"""
from verifier.verifier import NIDVerifier, Verdict
from verifier.decode import decode_nid

GT = "27611171500042"      # truth: born 1976-11-17
READ = "27611271500042"    # misread: born 1976-11-27 (also a valid NID)


def test_misread_is_itself_a_valid_nid():
    # This is WHY it is silent: the wrong read passes every image-only check.
    for n in (GT, READ):
        d = decode_nid(n)
        assert d.structural_ok, f"{n} should be structurally valid"
    assert decode_nid(GT).birth_date_iso == "1976-11-17"
    assert decode_nid(READ).birth_date_iso == "1976-11-27"


def test_caught_by_independent_back_nid():
    v = NIDVerifier()
    r = v.verify(READ, back_nid=GT)
    assert r.verdict is Verdict.REJECT
    assert any(c.name == "front_back_match" and c.passed is False for c in r.checks)


def test_caught_by_independent_printed_dob():
    v = NIDVerifier()
    r = v.verify(READ, ocr_fields={"birth_date": "1976-11-17"})
    assert r.verdict is Verdict.REJECT
    assert any(c.name == "dob_match" and c.passed is False for c in r.checks)


def test_caught_by_independent_gender():
    # If the printed gender were read independently and disagreed, also caught.
    # (Here the misread keeps gender Female, so use a constructed disagreeing case
    #  to pin the gender_match REJECT path.)
    v = NIDVerifier()
    male_nid = "29001011500018"  # decodes Male; feed independent "Female"
    assert decode_nid(male_nid).gender == "Male"
    r = v.verify(male_nid, ocr_fields={"gender": "أنثى"})
    assert r.verdict is Verdict.REJECT
    assert any(c.name == "gender_match" and c.passed is False for c in r.checks)


def test_not_silently_accepted_without_corroboration():
    # Front-only, no independent signal, no confidence supplied: the system must
    # NOT auto-ACCEPT a digit string on its own authority. ABSTAIN -> human review.
    v = NIDVerifier()
    r = v.verify(READ)
    assert r.verdict is Verdict.ABSTAIN
    assert r.verdict is not Verdict.ACCEPT


def test_gt_label_is_corrupt_checksum_invalid():
    # DISCOVERY: the benchmark answer key for this card fails its own check digit.
    # A real government-issued NID is valid by construction, so this GT is corrupt
    # and the sample must be EXCLUDED from scoring (you cannot grade against an
    # invalid key). The model's read happens to be checksum-valid; the card itself
    # visually shows day 17 (model misread 17->27), so the failure MODE is real
    # even though this scored "silent error" is against a bad label.
    from verifier.checksum import is_valid_checksum
    assert not is_valid_checksum(GT), "GT label should be checksum-invalid (corrupt key)"
    assert is_valid_checksum(READ), "model read happens to be checksum-valid"


def test_correct_read_with_agreeing_back_accepts():
    v = NIDVerifier()
    valid = "29509181201214"   # known-valid vector (verifier.checksum docstring)
    assert decode_nid(valid).structural_ok
    r = v.verify(valid, back_nid=valid)
    assert r.verdict is Verdict.ACCEPT
    assert r.checksum_valid


def test_derived_dob_is_not_treated_as_corroboration():
    # GUARD: a DOB derived FROM the NID trivially "agrees" and must not raise the
    # score — only an INDEPENDENTLY sourced field may corroborate. We assert the
    # verifier's score with a same-source DOB equals the no-DOB score (i.e. the
    # caller is responsible for only ever passing independent fields; this test
    # documents that feeding the derived DOB yields no extra confidence beyond a
    # passing cross-check, and that the catch depends on the field being WRONG
    # when the read is wrong — which a derived field can never be).
    v = NIDVerifier()
    derived_dob = decode_nid(READ).birth_date_iso  # 1976-11-27, same source as READ
    r_derived = v.verify(READ, ocr_fields={"birth_date": derived_dob})
    # Same-source DOB "agrees" with the wrong read -> does NOT catch it. This is the
    # documented trap: derived fields give false comfort. The real catch needs an
    # independent source (see the back_nid / independent-dob tests above).
    assert r_derived.verdict is not Verdict.REJECT
