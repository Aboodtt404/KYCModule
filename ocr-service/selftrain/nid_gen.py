"""
Valid-checksummed Egyptian-NID generator with perfect ground truth.

This extends Wael's synthetic-back idea (generate_synthetic_backs.py drew a
RANDOM serial with no checksum and no semantic GT) by emitting structurally- and
checksum-VALID NIDs, so synthetic data ships with perfect, verifiable ground
truth. The same `valid_nid()` can be imported by the back generator to upgrade
its serial field to a real NID.

A valid NID here is: real past calendar date, officially-assigned governorate
code, and a correct mod-11 check digit (verifier.checksum is the single source
of truth for the check digit — we do not re-implement it).
"""

from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from verifier.checksum import check_digit, is_valid_checksum  # noqa: E402
from verifier.governorates import GOVERNORATES  # noqa: E402

_GOV_CODES = [c for c in GOVERNORATES if c != "88"]   # skip 'Foreign' for realism


def valid_nid(rng: random.Random) -> str:
    """Return a structurally- and checksum-valid 14-digit NID (Western digits)."""
    century_digit, base_year = rng.choice([("2", 1900), ("3", 2000)])
    # keep dates real & in the past (years up to ~2010 so all are plausibly adults)
    if century_digit == "3":
        yy = rng.randint(0, 10)
    else:
        yy = rng.randint(40, 99)
    mm = rng.randint(1, 12)
    dd = rng.randint(1, 28)            # 28 keeps every month valid
    gov = rng.choice(_GOV_CODES)
    serial = rng.randint(0, 999)
    gender = rng.randint(0, 9)         # last serial digit; parity = gender
    first13 = f"{century_digit}{yy:02d}{mm:02d}{dd:02d}{gov}{serial:03d}{gender}"
    assert len(first13) == 13, first13
    nid = first13 + str(check_digit(first13))
    assert is_valid_checksum(nid)
    return nid


def make_population(n: int, seed: int = 0) -> list[str]:
    """Deterministic list of `n` distinct valid NIDs."""
    rng = random.Random(seed)
    seen: set[str] = set()
    out: list[str] = []
    while len(out) < n:
        nid = valid_nid(rng)
        if nid not in seen:
            seen.add(nid)
            out.append(nid)
    return out
