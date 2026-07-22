"""
The confident-error harness — the scoring oracle of the methodology.

The enemy is confident-WRONG output, not low fill-rate. This package scores a
pipeline's output against frozen ground truth and reports, as the HEADLINE
metric, the **confident-error rate** (emitted + high-confidence + wrong). It
also reports fill-rate, but explicitly labelled "NOT correctness" — that
relabelling is the entire point (it is Wael's documented blind spot).

Modules:
  schema.py    — Prediction / GroundTruth / Sample records + JSONL I/O
  compare.py   — field normalisation + correctness comparison (NID/name/date/…)
  metrics.py   — confident-error rate, accuracy, abstention, verifier catch/FA
  scorecard.py — assemble the §7 scorecard + render
  vendor.py    — commercial-vendor reference oracle (real HTTP path behind a key)
  run.py       — CLI: predictions.jsonl + ground_truth.jsonl -> scorecard

It is ADDITIVE and imports the verifier package; it never touches server.py.
"""

from .schema import Prediction, GroundTruth, FieldPred, load_predictions, load_ground_truth
from .metrics import score_field, score_dataset, FieldScore, DatasetScore
from .scorecard import build_scorecard, render_scorecard

__all__ = [
    "Prediction", "GroundTruth", "FieldPred",
    "load_predictions", "load_ground_truth",
    "score_field", "score_dataset", "FieldScore", "DatasetScore",
    "build_scorecard", "render_scorecard",
]
