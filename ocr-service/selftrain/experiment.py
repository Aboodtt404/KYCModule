"""
The self-training experiment (Phase 0 core). Run:

    python -m selftrain.experiment            # default config
    python -m selftrain.experiment --rounds 2 --pool 2500 --seed-imgs 50

Pipeline (all real, CPU-only, deterministic):
  1. Build a population of DISTINCT valid NIDs; split into frozen HELD-OUT,
     small labelled SEED, large UNLABELLED pool. (Disjoint by construction.)
  2. Render every image; cache cells. Held-out renders are bit-identical across
     rounds (deterministic in nid) — no leakage via re-render.
  3. Round 0: train the weak baseline on SEED only; evaluate on held-out.
  4. Each self-training round: read the unlabelled pool with the CURRENT model,
     keep ONLY checksum(verifier)-passing reads as pseudo-labels, add their
     per-digit (cell,label) pairs to the training set, RETRAIN, re-evaluate.
  5. Report per round: full-number accuracy, per-digit accuracy, raw
     confident-error rate, verifier-gated confident-error rate, abstention,
     pseudo-labels kept, and the anti-gaming "checksum-valid-but-≠-GT" rate.

Validated claim (asserted in tests): accuracy ↑ and confident-error ↓ across
≥2 rounds; held-out never trained on; anti-gaming rate ≈ 0.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from verifier.checksum import is_valid_checksum            # noqa: E402
from verifier.decode import decode_nid                     # noqa: E402
from selftrain.nid_gen import make_population              # noqa: E402
from selftrain.render import render_nid, cells_to_features, N_DIGITS  # noqa: E402
from selftrain.extractor import DigitExtractor             # noqa: E402


@dataclass
class RoundReport:
    round: int
    n_train_cells: int
    full_number_accuracy: float            # over ALL held-out (must ↑)
    per_digit_accuracy: float
    coverage_verified: float               # fraction emitted (checksum-passing)
    accuracy_over_emitted_verified: float  # of emitted, fraction correct
    # THE ABLATION (plan §7/§10): no verifier => every wrong read is confident.
    confident_error_no_verifier: float     # = 1 - full_number_accuracy
    # THE SYSTEM: abstain on checksum-fail => confident-wrong that still slip = ~0.
    confident_error_with_verifier: float   # checksum-passes AND wrong
    pseudo_labels_kept: int
    pseudo_label_error_rate: float         # anti-gaming: kept & predicted!=GT


def _stack_features(nids, seed, noise):
    """Render every nid and return a stacked feature matrix (len*14, D) plus the
    nid list — so the whole set can be scored in ONE predict_proba call."""
    feats = []
    for nid in nids:
        cells = render_nid(nid, seed=seed, noise=noise)   # (14, CELL, CELL)
        feats.append(cells_to_features(cells))            # (14, D)
    X = np.vstack(feats)                                  # (len*14, D)
    return X, nids


def _batch_read(model: DigitExtractor, X, nids):
    """One predict_proba over (len*14, D). Returns list of (nid, read, min_conf)."""
    proba = model.clf.predict_proba(X)                    # (len*14, classes)
    classes = model.clf.classes_
    idx = proba.argmax(axis=1)
    conf = proba.max(axis=1)
    preds = classes[idx].astype(int)
    out = []
    for i, nid in enumerate(nids):
        s = i * N_DIGITS
        read = "".join(str(int(d)) for d in preds[s:s + N_DIGITS])
        min_conf = float(conf[s:s + N_DIGITS].min())
        out.append((nid, read, min_conf))
    return out, preds


def _eval_heldout(model: DigitExtractor, X_held, held_nids) -> dict:
    n = len(held_nids)
    reads, preds = _batch_read(model, X_held, held_nids)
    full_correct = digit_correct = digit_total = 0
    emitted_ver = emitted_ver_correct = conf_err_with_ver = 0
    for nid, read, _mc in reads:
        correct = (read == nid)
        full_correct += int(correct)
        for a, b in zip(read, nid):
            digit_total += 1
            digit_correct += int(a == b)
        if is_valid_checksum(read):
            emitted_ver += 1
            if correct:
                emitted_ver_correct += 1
            else:
                conf_err_with_ver += 1
    full_acc = full_correct / n
    return {
        "full_number_accuracy": full_acc,
        "per_digit_accuracy": digit_correct / digit_total,
        "coverage_verified": emitted_ver / n,
        "accuracy_over_emitted_verified": (emitted_ver_correct / emitted_ver) if emitted_ver else 0.0,
        # Ablation: no verifier, no abstention => every wrong read is confident.
        "confident_error_no_verifier": 1.0 - full_acc,
        # System: a wrong read that still passes the checksum (rare).
        "confident_error_with_verifier": conf_err_with_ver / n,
    }


def run_experiment(
    rounds: int = 2,
    n_heldout: int = 500,
    n_seed: int = 50,
    n_pool: int = 2500,
    noise: float = 0.025,
    pseudo_gate: float = 0.80,
    max_pseudo_per_round: int = 400,
    use_verifier_filter: bool = True,
    render_seed: int = 7,
    model_seed: int = 0,
    verbose: bool = True,
) -> dict:
    # 1. distinct population, disjoint splits
    total = n_heldout + n_seed + n_pool
    pop = make_population(total, seed=123)
    heldout = pop[:n_heldout]
    seed_nids = pop[n_heldout:n_heldout + n_seed]
    pool_nids = pop[n_heldout + n_seed:]
    assert len(set(heldout) & set(seed_nids)) == 0
    assert len(set(heldout) & set(pool_nids)) == 0

    # 2. render to stacked feature matrices once. Held-out deterministic & frozen.
    X_held, _ = _stack_features(heldout, render_seed, noise)
    X_seed, _ = _stack_features(seed_nids, render_seed, noise)
    X_pool, _ = _stack_features(pool_nids, render_seed, noise)
    D = X_held.shape[1]

    # seed training cells (X, y): each image contributes 14 (cell, true-digit) rows
    y_seed = np.concatenate([np.array([int(d) for d in nid]) for nid in seed_nids])
    X_train, y_train = X_seed, y_seed

    used_pool: set[int] = set()
    reports: list[RoundReport] = []

    for rnd in range(rounds + 1):
        model = DigitExtractor(seed=model_seed).fit(X_train, y_train)
        ev = _eval_heldout(model, X_held, heldout)

        kept = 0
        kept_wrong = 0
        if rnd < rounds:
            reads, _preds = _batch_read(model, X_pool, pool_nids)
            # "verifier-passed" pseudo-label = checksum valid AND confident.
            # The confidence gate removes coincidental checksum passes from a
            # weak model (a wrong read has a low-confidence digit somewhere),
            # which is what keeps pseudo-label precision high (anti-gaming).
            # The full verifier gate: checksum valid AND structurally valid
            # (real calendar date + officially-assigned governorate). The
            # structural check rejects checksum-coincidental wrong reads that
            # decode to an impossible date/gov, at ZERO cost to true reads (all
            # genuine NIDs decode cleanly), pushing pseudo-label precision up.
            # ABLATION: use_verifier_filter=False keeps reads on confidence
            # ALONE — the control proving the verifier (not retraining) is the
            # engine.
            def _verifier_ok(read: str) -> bool:
                return is_valid_checksum(read) and decode_nid(read).structural_ok
            cands = [(i, nid, read, mc) for i, (nid, read, mc) in enumerate(reads)
                     if i not in used_pool and mc >= pseudo_gate
                     and (_verifier_ok(read) if use_verifier_filter else True)]
            # take the most-confident first (bounds compute AND raises precision)
            cands.sort(key=lambda t: t[3], reverse=True)
            if max_pseudo_per_round:
                cands = cands[:max_pseudo_per_round]
            add_X, add_y = [], []
            for i, nid, read, _mc in cands:
                add_X.append(X_pool[i * N_DIGITS:(i + 1) * N_DIGITS])
                add_y.append(np.array([int(d) for d in read]))
                used_pool.add(i)
                kept += 1
                if read != nid:
                    kept_wrong += 1
            if add_X:
                X_train = np.vstack([X_train] + add_X)
                y_train = np.concatenate([y_train] + add_y)

        reports.append(RoundReport(
            round=rnd,
            n_train_cells=int(y_train.shape[0]),
            full_number_accuracy=ev["full_number_accuracy"],
            per_digit_accuracy=ev["per_digit_accuracy"],
            coverage_verified=ev["coverage_verified"],
            accuracy_over_emitted_verified=ev["accuracy_over_emitted_verified"],
            confident_error_no_verifier=ev["confident_error_no_verifier"],
            confident_error_with_verifier=ev["confident_error_with_verifier"],
            pseudo_labels_kept=kept,
            pseudo_label_error_rate=(kept_wrong / kept) if kept else 0.0,
        ))
        if verbose:
            r = reports[-1]
            print(f"[round {rnd}] full#acc={r.full_number_accuracy:.3f} "
                  f"perdigit={r.per_digit_accuracy:.3f} "
                  f"cov(ver)={r.coverage_verified:.3f} "
                  f"acc@emit={r.accuracy_over_emitted_verified:.3f} "
                  f"confERR[noVer]={r.confident_error_no_verifier:.3f} "
                  f"confERR[Ver]={r.confident_error_with_verifier:.4f} "
                  f"kept={r.pseudo_labels_kept} pseudo-err={r.pseudo_label_error_rate:.4f}")

    summary = {
        "config": {
            "rounds": rounds, "n_heldout": n_heldout, "n_seed": n_seed,
            "n_pool": n_pool, "noise": noise, "pseudo_gate": pseudo_gate,
            "max_pseudo_per_round": max_pseudo_per_round,
            "use_verifier_filter": use_verifier_filter,
            "render_seed": render_seed, "model_seed": model_seed,
        },
        "leakage_check": {
            "heldout_in_seed": len(set(heldout) & set(seed_nids)),
            "heldout_in_pool": len(set(heldout) & set(pool_nids)),
        },
        "rounds": [asdict(r) for r in reports],
        "deltas": {
            "full_number_accuracy": reports[-1].full_number_accuracy - reports[0].full_number_accuracy,
            "confident_error_no_verifier": reports[-1].confident_error_no_verifier - reports[0].confident_error_no_verifier,
            "confident_error_with_verifier_max": max(r.confident_error_with_verifier for r in reports),
        },
        "anti_gaming_max_pseudo_label_error_rate": max(r.pseudo_label_error_rate for r in reports),
    }
    return summary


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=2)
    ap.add_argument("--heldout", type=int, default=500)
    ap.add_argument("--seed-imgs", type=int, default=50)
    ap.add_argument("--pool", type=int, default=2500)
    ap.add_argument("--noise", type=float, default=0.025)
    ap.add_argument("--pseudo-gate", type=float, default=0.80)
    ap.add_argument("--max-pseudo-per-round", type=int, default=400)
    ap.add_argument("--out", default="")
    args = ap.parse_args(argv)
    summary = run_experiment(
        rounds=args.rounds, n_heldout=args.heldout, n_seed=args.seed_imgs,
        n_pool=args.pool, noise=args.noise, pseudo_gate=args.pseudo_gate,
        max_pseudo_per_round=args.max_pseudo_per_round)
    print("\nSUMMARY:")
    print(json.dumps(summary["deltas"], indent=2))
    print("anti-gaming max pseudo-label error rate:",
          summary["anti_gaming_max_pseudo_label_error_rate"])
    if args.out:
        Path(args.out).write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"[wrote {args.out}]")
    return summary


if __name__ == "__main__":
    main()
