"""rectify.py — landmark-based perspective rectification for Egyptian ID fronts.

The document-scanner step (Abdelrahman's direction): map every capture, at any
angle, onto one canonical flat card so the field layout becomes a constant.
Classical edge/contour quad detection fails on real captures (1/9 on office
data — glare, hands, white-on-light backgrounds). Instead the card's CONTENT is
the correspondence set: the field detector reliably finds the photo, header
logo, NID row, serial and dob box; their canonical positions on the fixed ID-1
layout are known (medians over 24 real office captures, 2026-07-28, spreads of
a few percent). ≥4 landmarks → homography → warp to canonical 1712×1080.

Returns None when not enough landmarks or the transform is implausible — the
caller falls back to the plain crop+deskew path.
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

log = logging.getLogger(__name__)

CANON_W, CANON_H = 1712, 1080   # ID-1 aspect (85.6 x 54.0 mm)

# Normalized landmark centers on the canonical card (median of 24 real captures).
CANONICAL = {
    "photo":      (0.164, 0.331),
    "front_logo": (0.650, 0.121),
    "nid":        (0.712, 0.818),
    "serial":     (0.210, 0.944),
    "dob":        (0.203, 0.787),
}
_MIN_CONF = 0.30


def rectify_card(img, yolo_fields):
    """Full frame -> canonical flat card via landmark homography, or None."""
    try:
        det = yolo_fields(img, verbose=False)[0]
    except Exception as exc:  # noqa: BLE001
        log.warning("rectify: field inference failed: %s", exc)
        return None
    if det.boxes is None or len(det.boxes) == 0:
        return None

    best = {}
    for b in det.boxes:
        name = det.names[int(b.cls[0])]
        if name not in CANONICAL:
            continue
        conf = float(b.conf[0])
        if conf < _MIN_CONF or conf <= best.get(name, (0.0, None))[0]:
            continue
        x1, y1, x2, y2 = [float(v) for v in b.xyxy[0]]
        best[name] = (conf, ((x1 + x2) / 2, (y1 + y2) / 2))
    if len(best) < 4:
        return None

    src = np.array([xy for _, xy in best.values()], dtype=np.float32)
    dst = np.array([(CANONICAL[n][0] * CANON_W, CANONICAL[n][1] * CANON_H)
                    for n in best], dtype=np.float32)
    if len(best) == 4:
        M = cv2.getPerspectiveTransform(src, dst)
    else:
        M, _ = cv2.findHomography(src, dst, cv2.RANSAC, 40.0)
    if M is None:
        return None

    # Plausibility: the transform must be near-affine for a photo of a flat
    # card (small perspective terms) and must not mirror or collapse.
    if abs(M[2, 0]) > 2e-3 or abs(M[2, 1]) > 2e-3:
        return None
    detA = M[0, 0] * M[1, 1] - M[0, 1] * M[1, 0]
    if detA <= 0:
        return None

    warped = cv2.warpPerspective(img, M, (CANON_W, CANON_H), flags=cv2.INTER_LANCZOS4,
                                 borderMode=cv2.BORDER_REPLICATE)
    log.info("rectify: %d landmarks -> canonical card", len(best))
    return warped
