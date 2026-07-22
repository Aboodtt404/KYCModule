"""
Render a 14-digit NID to a noisy image and crop it into 14 per-digit cells.

We render the digits into fixed-width cells (we control layout), so cropping is
exact and the task reduces to per-digit recognition — the right granularity for
proving checksum-grounded self-training (it isolates recognition from
localisation). Realism comes from controlled nuisances: multiple fonts, per-cell
rotation, position jitter, blur, brightness and additive noise. Difficulty is
tunable via `noise` so we can make a deliberately-weak baseline learnable but
imperfect.

Deterministic given (nid, seed): the SAME nid renders the SAME cells, so a
held-out image is identical across rounds (no accidental leakage via re-render).
"""

from __future__ import annotations

import io
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

CELL = 24            # per-digit cell, pixels (square)
N_DIGITS = 14

_FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf",
    "/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf",
]


def _load_fonts(size: int) -> list:
    fonts = []
    for p in _FONT_PATHS:
        try:
            fonts.append(ImageFont.truetype(p, size))
        except OSError:
            continue
    if not fonts:
        fonts = [ImageFont.load_default()]
    return fonts


_FONTS = _load_fonts(int(CELL * 0.8))


def render_digit_cell(digit: str, rng: random.Random, noise: float) -> np.ndarray:
    """Render one digit into a CELLxCELL grayscale array in [0,1] with nuisances."""
    pad = CELL // 2
    big = Image.new("L", (CELL + 2 * pad, CELL + 2 * pad), color=255)
    draw = ImageDraw.Draw(big)
    font = rng.choice(_FONTS)
    # centre the glyph using its tight bbox, then jitter
    try:
        l, t, r, b = draw.textbbox((0, 0), digit, font=font)
    except Exception:
        l, t, r, b = 0, 0, CELL // 2, CELL
    gw, gh = r - l, b - t
    x = (big.width - gw) / 2 - l
    y = (big.height - gh) / 2 - t
    jitter = max(1, int(CELL * 0.12))
    x += rng.uniform(-jitter, jitter)
    y += rng.uniform(-jitter, jitter)
    ink = rng.randint(0, 60)
    draw.text((x, y), digit, fill=ink, font=font)
    # rotate
    angle = rng.uniform(-7, 7)
    big = big.rotate(angle, resample=Image.BILINEAR, fillcolor=255)
    # blur
    if rng.random() < 0.5:
        big = big.filter(ImageFilter.GaussianBlur(rng.uniform(0.2, 0.8)))
    # crop centre cell
    left = (big.width - CELL) // 2
    top = (big.height - CELL) // 2
    cell = big.crop((left, top, left + CELL, top + CELL))
    arr = np.asarray(cell, dtype=np.float32) / 255.0
    # brightness + additive noise
    arr = np.clip(arr * rng.uniform(0.85, 1.0) + rng.uniform(-0.05, 0.05), 0, 1)
    if noise > 0:
        arr = np.clip(arr + rng.normal(0, noise, arr.shape).astype(np.float32), 0, 1)
    return arr


def render_nid(nid: str, seed: int, noise: float = 0.10) -> np.ndarray:
    """Render a full 14-digit NID -> array of shape (14, CELL, CELL) in [0,1].

    Deterministic in (nid, seed): identical output every call. `rng` is seeded
    from a stable hash of the nid so a held-out image is bit-identical across
    training rounds (guards against leakage via re-render).
    """
    rng = random.Random(f"{nid}:{seed}")
    npr = np.random.RandomState(rng.randint(0, 2**31 - 1))
    # wrap rng to also offer normal() via npr
    class _R:
        def __init__(self, r, n): self._r, self._n = r, n
        def choice(self, x): return self._r.choice(x)
        def uniform(self, a, b): return self._r.uniform(a, b)
        def randint(self, a, b): return self._r.randint(a, b)
        def random(self): return self._r.random()
        def normal(self, m, s, shape): return self._n.normal(m, s, shape)
    R = _R(rng, npr)
    cells = np.stack([render_digit_cell(d, R, noise) for d in nid])
    return cells


def cells_to_features(cells: np.ndarray) -> np.ndarray:
    """(N, CELL, CELL) -> (N, CELL*CELL) flat feature vectors for the classifier."""
    return cells.reshape(cells.shape[0], -1)
