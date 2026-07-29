"""Document liveness: specular dynamics under torch while the card tilts.

Physics: the phone torch sits next to the lens, so on a GLOSSY laminated card
the specular reflection is a compact highlight that SWEEPS ACROSS the card as
the user tilts it (and Egyptian IDs add holographic/OVI patches that flare and
colour-shift). A matte paper print scatters the torch diffusely — almost no
saturated highlight in any frame. A screen replay reflects the torch off cover
glass as one large static blob (and LCD panels dim off-axis).

The client captures a short burst of frames while guiding a slow tilt with the
torch on; this module scores how card-like the specular behaviour is.

CALIBRATION STATUS: ABSTAIN/log-only. The thresholds encode the physics above
but have not yet seen real office attacks — score distributions get calibrated
from the same office corpus runs as the FFT PAD stage. A "flat" or
"screen-like" hint must never auto-reject on its own.
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

log = logging.getLogger("ocr-server")

# HSV gates for "saturated specular highlight": very bright, nearly colourless.
_V_MIN = 235
_S_MAX = 70


def _specular_mask(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    return ((hsv[..., 2] >= _V_MIN) & (hsv[..., 1] <= _S_MAX)).astype(np.uint8)


def analyze(frames_bgr: list[np.ndarray]) -> dict:
    """Score a tilt burst (3+ frames, card roughly filling the guide box).
    Returns {"frames": n, "specular_frac": [...], "dynamics": float,
             "hue_shift": float, "hint": "card-like|flat|screen-like|weak"}.
    """
    if len(frames_bgr) < 3:
        return {"frames": len(frames_bgr), "hint": "weak",
                "specular_frac": [], "dynamics": 0.0, "hue_shift": 0.0}

    # Uniform working size — dynamics compare masks across frames.
    frames = [cv2.resize(f, (480, int(480 * f.shape[0] / f.shape[1])))
              for f in frames_bgr]
    h = min(f.shape[0] for f in frames)
    frames = [f[:h] for f in frames]

    masks = [_specular_mask(f) for f in frames]
    fracs = [float(m.mean()) for m in masks]

    union = np.clip(sum(masks), 0, 1)
    union_frac = float(union.mean())
    mean_frac = float(np.mean(fracs))

    # Sweep factor: how much MORE card area the highlight covered over the
    # burst than in any single frame. A moving blob unions to several times
    # its per-frame footprint; a static blob unions to ~1x.
    dynamics = union_frac / mean_frac - 1.0 if mean_frac > 1e-5 else 0.0

    # Holo colour-shift: hue variability across frames inside the swept region
    # (dilated) — OVI patches change colour with angle, plain gloss doesn't.
    hue_shift = 0.0
    if union_frac > 1e-4:
        region = cv2.dilate(union, np.ones((9, 9), np.uint8)).astype(bool)
        hues = []
        for f in frames:
            hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
            sel = hsv[..., 0][region & (hsv[..., 1] > 60)]
            if sel.size > 50:
                hues.append(float(np.median(sel)))
        if len(hues) >= 3:
            hue_shift = float(np.std(hues))

    if mean_frac > 0.08:
        hint = "screen-like"          # one huge saturated blob every frame
    elif max(fracs) < 0.002:
        hint = "flat"                 # matte — torch never produced a highlight
    elif dynamics >= 1.0 and 0.002 <= mean_frac <= 0.08:
        hint = "card-like"            # compact highlight that swept the card
    else:
        hint = "weak"                 # inconclusive (tilt too small, etc.)

    out = {"frames": len(frames), "specular_frac": [round(f, 4) for f in fracs],
           "dynamics": round(float(dynamics), 2), "hue_shift": round(hue_shift, 1),
           "hint": hint}
    log.info("holo tilt: %s", out)
    return out
