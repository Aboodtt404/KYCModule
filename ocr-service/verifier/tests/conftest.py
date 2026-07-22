"""Shared helpers for verifier tests."""
import random

from verifier.checksum import check_digit

# Officially-assigned governorate codes (subset is fine for synthesis).
VALID_GOV = ["01", "02", "03", "04", "11", "12", "13", "21", "24", "26", "88"]


def make_valid_nid(
    century: str = "2",
    yy: int = 92,
    mm: int = 4,
    dd: int = 29,
    gov: str = "24",
    serial: int = 2,
    gender_male: bool = True,
    rng: random.Random | None = None,
) -> str:
    """Construct a structurally-valid, checksum-valid 14-digit NID.

    Used so positive-control tests start from a genuinely valid number, then
    corrupt it and assert the verifier rejects.
    """
    if rng is not None:
        century = rng.choice(["2", "3"])
        # keep dates real & in the past
        yy = rng.randint(0, 99)
        mm = rng.randint(1, 12)
        dd = rng.randint(1, 28)
        gov = rng.choice(VALID_GOV)
        serial = rng.randint(0, 999)
        gender_male = rng.choice([True, False])
    # 4-digit seq+gender block: last digit parity encodes gender
    seq3 = f"{serial:03d}"
    gdigit = 1 if gender_male else 0  # any odd=male, even=female; pick 1/0
    block4 = seq3 + str(gdigit)
    first13 = f"{century}{yy:02d}{mm:02d}{dd:02d}{gov}{block4}"
    assert len(first13) == 13, first13
    cd = check_digit(first13)
    return first13 + str(cd)
