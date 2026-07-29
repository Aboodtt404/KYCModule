"""Presentation-attack spectral screening (screen recapture / print recapture).

A card photographed OFF A SCREEN carries the display's pixel grid; a PRINTED
copy carries the printer's halftone dot screen. Both are strictly periodic
patterns invisible to the eye but unmistakable in the 2D Fourier domain: they
concentrate energy into isolated off-center peaks, while genuine card texture
(and ordinary photo noise) has a smooth, monotonically-decaying spectrum.

Method: log-magnitude spectrum of a Hann-windowed 512x512 luminance patch,
local-median-flattened; count isolated peaks that stand far above the residual
noise floor in the mid-frequency annulus. JPEG's own 8x8 block harmonics sit
on the frequency axes, so the axes are masked out.

CALIBRATION STATUS: thresholds below give clean separation between all real
office captures and synthetic screen/halftone attacks (2026-07-29), but no
REAL replay corpus has been scored yet. Until the office produces one
(photocopies + screen replays through the normal flow), this signal is
LOG-ONLY: it is reported in the API response and server log for corpus
building, and never changes a verdict.
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

log = logging.getLogger("ocr-server")

_SIZE = 512


def _tiles(gray: np.ndarray, size: int = _SIZE, max_tiles: int = 4):
    """Native-resolution tiles — NEVER whole-card resize: downscaling low-passes
    exactly the pixel-grid/halftone periodicity this detector hunts."""
    h, w = gray.shape[:2]
    if h < size or w < size:
        # small card crop: single centered zero-padded tile
        pad = np.zeros((size, size), np.float32)
        t = gray[:size, :size].astype(np.float32)
        pad[:t.shape[0], :t.shape[1]] = t - t.mean()
        yield pad
        return
    ys = [int((h - size) * f) for f in (0.15, 0.55)]
    xs = [int((w - size) * f) for f in (0.15, 0.65)]
    n = 0
    for y in ys:
        for x in xs:
            if n >= max_tiles:
                return
            t = gray[y:y + size, x:x + size].astype(np.float32)
            yield t - t.mean()
            n += 1


def screen_print_score(card_bgr: np.ndarray) -> dict:
    """Spectral peak analysis of a card image (rectified crop preferred).
    Returns {"peaks": int, "peak_energy": float, "suspect": bool}.
    Averages log-spectra over native-res tiles: periodic peaks add coherently,
    scene content averages out.
    """
    gray = cv2.cvtColor(card_bgr, cv2.COLOR_BGR2GRAY) if card_bgr.ndim == 3 else card_bgr
    win = np.hanning(_SIZE).astype(np.float32)
    win2d = win[:, None] * win[None, :]

    acc = np.zeros((_SIZE, _SIZE), np.float32)
    n = 0
    for tile in _tiles(gray):
        spec = np.abs(np.fft.fftshift(np.fft.fft2(tile * win2d)))
        acc += np.log1p(spec).astype(np.float32)
        n += 1
    spec = acc / max(n, 1)

    # Flatten the smooth natural-image spectrum; what survives is periodicity.
    # (medianBlur at ksize 21 needs 8U — quantize; sigma-relative thresholds
    # below are scale-free.)
    lo, hi = float(spec.min()), float(spec.max())
    spec_u8 = ((spec - lo) / max(hi - lo, 1e-6) * 255).astype(np.uint8)
    med = cv2.medianBlur(spec_u8, 21).astype(np.float32) / 255 * (hi - lo) + lo
    resid = spec - med

    c = _SIZE // 2
    yy, xx = np.mgrid[-c:c, -c:c]
    r = np.hypot(yy, xx)
    # Mid-frequency annulus: below ~24 is card layout/lighting; above ~245 is
    # demosaic/JPEG corner junk. JPEG's 8x8 block grid puts harmonics at exact
    # multiples of _SIZE/8=64 on the axes of every legitimate capture — mask
    # small disks at those spots ONLY (a whole-axis mask would also swallow
    # 45-degree halftone screens, whose cos*cos dot grid factors into pure
    # x/y-axis cosines).
    mask = (r > 24) & (r < 245)
    for k in (1, 2, 3):
        mask &= np.hypot(yy, np.abs(xx) - 64 * k) > 6   # (±64k, 0) spots
        mask &= np.hypot(np.abs(yy) - 64 * k, xx) > 6   # (0, ±64k) spots

    vals = resid[mask]
    floor = float(np.median(vals))
    sigma = float(vals.std()) or 1.0
    thr = floor + 8.0 * sigma

    peaks_mask = ((resid > thr) & mask).astype(np.uint8)
    n_labels, _, stats, _ = cv2.connectedComponentsWithStats(peaks_mask, connectivity=8)
    # Ignore one-pixel specks; real grid harmonics are compact blobs.
    peaks = int(sum(1 for i in range(1, n_labels) if stats[i, cv2.CC_STAT_AREA] >= 2))
    peak_energy = float(resid[peaks_mask.astype(bool)].sum())

    # Provisional gate (synthetic-calibrated, see module docstring): a display
    # grid or halftone screen concentrates energy into few STRONG symmetric
    # harmonics; genuine captures measured 0 blobs across the whole corpus.
    suspect = peaks >= 2 and peak_energy > 12.0
    return {"peaks": peaks, "peak_energy": round(peak_energy, 1), "suspect": suspect}
