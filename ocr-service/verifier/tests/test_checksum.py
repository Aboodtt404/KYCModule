"""
Check-digit tests, including the RED-ABLE positive controls the mission demands:
valid numbers pass; EVERY single-digit corruption fails.

The mod-11 weighted checksum catches ~all single-digit errors because every
weight is in {2..7} (coprime to 11), so any nonzero single-digit delta d gives
d*w not congruent to 0 (mod 11). The one documented exception is the
remainder-0/10 collapse (see test below). These tests prove the behaviour
empirically across the full corruption space of many random valid NIDs — so if
the algorithm were ever wrong/loosened, they go red.
"""
import random

import pytest

from verifier.checksum import check_digit, is_valid_checksum, CHECKSUM_ALGORITHM
from .conftest import make_valid_nid


# Cross-checked vectors from two independent open implementations + 1 real back.
KNOWN_VALID = [
    "30012240199931",   # independent repos: valid
    "29509181201214",   # independent repos: valid
    "29204292400211",   # REAL consented back (real_57_Back) — gold-standard oracle
]
KNOWN_INVALID = [
    "30012240199930",   # independent repos' negative test asserts exactly this
]


def test_algorithm_label_is_mod11():
    assert "mod11" in CHECKSUM_ALGORITHM


@pytest.mark.parametrize("nid", KNOWN_VALID)
def test_known_valid_vectors_pass(nid):
    assert is_valid_checksum(nid) is True, f"{nid} should be checksum-valid"


@pytest.mark.parametrize("nid", KNOWN_INVALID)
def test_known_invalid_vectors_fail(nid):
    assert is_valid_checksum(nid) is False, f"{nid} should be checksum-invalid"


def test_real_back_oracle_decodes_consistently():
    """The real back's NID must be valid AND decode to the printed facts."""
    from verifier.decode import decode_nid
    nid = "29204292400211"
    assert is_valid_checksum(nid)
    dec = decode_nid(nid)
    assert dec.structural_ok
    assert dec.birth_date_iso == "1992-04-29"
    assert dec.governorate == "Minya"
    assert dec.gender == "Male"      # printed ذكر on the card


def test_arabic_indic_numerals_accepted():
    assert is_valid_checksum("٢٩٢٠٤٢٩٢٤٠٠٢١١") is True


def test_wrong_length_is_invalid_not_exception():
    assert is_valid_checksum("123") is False
    assert is_valid_checksum("3001224019993") is False     # 13 digits
    assert is_valid_checksum("300122401999311") is False   # 15 digits


def test_check_digit_requires_13():
    with pytest.raises(ValueError):
        check_digit("123")


def test_generated_valid_nids_pass():
    rng = random.Random(7)
    for _ in range(500):
        nid = make_valid_nid(rng=rng)
        assert is_valid_checksum(nid), f"self-generated {nid} must be valid"


_WEIGHTS = (2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2)


def _remainder(first13: str) -> int:
    return sum(int(d) * w for d, w in zip(first13, _WEIGHTS)) % 11


def test_single_digit_corruption_catch_is_complete_modulo_documented_blindspot():
    """POSITIVE CONTROL (red-able): flipping any one digit of a valid NID must
    break the checksum — EXCEPT the one documented, provable blind spot.

    The real Egyptian algorithm collapses remainder 0 and remainder 10 BOTH to
    check digit 1 (a pure ISO-7064 mod-11 would emit 'X' for remainder 10 and
    catch 100%). So a single-digit error that shuttles the remainder between 0
    and 10 — only possible when the number's remainder is already 0 or 10 —
    survives. This test asserts:
      (1) corruptions of the CHECK DIGIT itself are ALWAYS caught,
      (2) the overall single-digit catch rate is >= 98%,
      (3) EVERY surviving corruption is exactly the r<->{0,10} collapse —
          zero UNEXPLAINED escapes. (3) is the teeth: if the algorithm were
          wrong or loosened, unexplained survivors would appear and go red.
    """
    rng = random.Random(123)
    total = caught = 0
    unexplained = []
    checkdigit_escapes = []
    for _ in range(300):
        nid = make_valid_nid(rng=rng)
        assert is_valid_checksum(nid)
        r0 = _remainder(nid[:13])
        for pos in range(14):
            orig = nid[pos]
            for repl in "0123456789":
                if repl == orig:
                    continue
                total += 1
                corrupted = nid[:pos] + repl + nid[pos + 1:]
                if not is_valid_checksum(corrupted):
                    caught += 1
                    continue
                # survived — must be the documented collapse
                if pos == 13:
                    checkdigit_escapes.append((nid, repl))
                elif {r0, _remainder(corrupted[:13])} != {0, 10}:
                    unexplained.append((nid, pos, orig, repl, corrupted))

    catch_rate = caught / total
    assert not checkdigit_escapes, f"check-digit corruptions escaped: {checkdigit_escapes[:5]}"
    assert not unexplained, f"UNEXPLAINED single-digit escapes: {unexplained[:5]}"
    assert catch_rate >= 0.98, f"single-digit catch rate {catch_rate:.4f} < 0.98"


def test_check_digit_is_unique_per_prefix():
    """Exactly one check digit in 0..9 is valid for any given prefix."""
    rng = random.Random(99)
    for _ in range(300):
        nid = make_valid_nid(rng=rng)
        prefix = nid[:13]
        valid_cds = [c for c in range(10) if is_valid_checksum(prefix + str(c))]
        assert len(valid_cds) == 1, f"prefix {prefix} had check digits {valid_cds}"
        assert valid_cds[0] == int(nid[13])
