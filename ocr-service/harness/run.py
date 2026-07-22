"""
CLI: score a pipeline run against a frozen benchmark and emit the §7 scorecard.

    python -m harness.run \
        --predictions run.jsonl \
        --ground-truth benchmark/.../ground_truth.jsonl \
        [--tau 0.90] [--vendor] [--out scorecard.json]

Prints the rendered scorecard and writes the JSON. With --vendor and a
KYC_VENDOR_KEY in the environment, also runs the commercial reference oracle.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# allow running as `python -m harness.run` from ocr-service/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness.schema import load_predictions, load_ground_truth
from harness.metrics import score_dataset
from harness.scorecard import build_scorecard, render_scorecard
from harness.vendor import run_vendor_oracle


def main(argv=None):
    ap = argparse.ArgumentParser(description="Confident-error harness scorecard")
    ap.add_argument("--predictions", required=True)
    ap.add_argument("--ground-truth", required=True)
    ap.add_argument("--tau", type=float, default=0.90,
                    help="confidence threshold for 'confident' (default 0.90)")
    ap.add_argument("--vendor", action="store_true",
                    help="also run the commercial reference oracle (needs KYC_VENDOR_KEY)")
    ap.add_argument("--title", default="KYC extraction scorecard")
    ap.add_argument("--provenance", default="")
    ap.add_argument("--out", default="")
    args = ap.parse_args(argv)

    preds = load_predictions(args.predictions)
    gt = load_ground_truth(args.ground_truth)
    ds = score_dataset(preds, gt, tau=args.tau)

    vendor_block = None
    if args.vendor:
        vendor_block = run_vendor_oracle(gt, preds)

    sc = build_scorecard(ds, title=args.title, provenance=args.provenance,
                         vendor_block=vendor_block)
    print(render_scorecard(sc))
    if args.out:
        Path(args.out).write_text(json.dumps(sc, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
        print(f"\n[wrote {args.out}]")
    return sc


if __name__ == "__main__":
    main()
