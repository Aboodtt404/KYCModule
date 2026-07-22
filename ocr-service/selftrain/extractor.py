"""
The digit extractor: a REAL, re-fittable per-digit classifier (sklearn MLP).

This is the model the self-training loop improves. It is deliberately
weakenable (train on a tiny seed) and genuinely retrainable (fit on an enlarged
set each round). It reads a rendered NID (14 cells) into a 14-digit string plus
per-digit confidences and an overall NID confidence (the weakest digit — a chain
is only as strong as its weakest link), which the harness uses for the
confident-error metric.
"""

from __future__ import annotations

import numpy as np
from sklearn.neural_network import MLPClassifier

from .render import cells_to_features


class DigitExtractor:
    """Per-digit classifier: a small MLP trained with the L-BFGS solver.

    L-BFGS is full-batch quasi-Newton, so fitting is DETERMINISTIC given the
    data (no minibatch / random-init noise like adam) — re-fitting on an
    enlarged set moves the model smoothly, which is what makes the
    self-training trend a clean, defensible proof rather than optimisation
    noise. It still has the capacity to clear the per-digit accuracy needed for
    checksum-passing reads to be dominated by truly-correct ones. The
    weakening is done honestly via a tiny labelled SEED, not by crippling the
    optimiser. (A higher-ceiling CNN is the T1 track's job, not this proof.)"""

    def __init__(self, hidden=(64,), max_iter: int = 800, seed: int = 0):
        self.clf = MLPClassifier(
            hidden_layer_sizes=hidden, solver="lbfgs", max_iter=max_iter,
            alpha=1e-3, random_state=seed,
        )
        self.fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "DigitExtractor":
        self.clf.fit(X, y)
        self.fitted = True
        return self

    def read(self, cells: np.ndarray) -> tuple[str, list[float], float]:
        """cells: (14, CELL, CELL) -> (nid_string, per_digit_conf, nid_conf)."""
        feats = cells_to_features(cells)
        proba = self.clf.predict_proba(feats)        # (14, n_classes)
        classes = self.clf.classes_
        idx = proba.argmax(axis=1)
        confs = proba.max(axis=1)
        nid = "".join(str(int(classes[i])) for i in idx)
        nid_conf = float(confs.min())                # weakest-digit confidence
        return nid, [float(c) for c in confs], nid_conf

    def per_digit_predict(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        proba = self.clf.predict_proba(X)
        classes = self.clf.classes_
        idx = proba.argmax(axis=1)
        return classes[idx].astype(int), proba.max(axis=1)
