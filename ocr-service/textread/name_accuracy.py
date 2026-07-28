#!/usr/bin/env python3
"""
name_accuracy.py — HONEST name metrics + a human-verifiable review sheet.

WHY: non-empty% and gazetteer-hit% measure PRESENCE / PLAUSIBILITY, not CORRECTNESS.
This script reports normalized exact-match agreement with the corpus label — and is
explicit that the corpus label is the 7B teacher's UNVERIFIED guess, so even an exact
match is "agreement with teacher," NOT verified ground truth. The ONLY path to a true
name-accuracy number is human review, so we also emit a review sheet for a human to mark.

Outputs:
  * printed metrics: firstName exact (raw + normalized), lastName first-token,
    lastName full-chain (normalized), agreement caveat.
  * name_review_sheet.json  — image path + predicted first/last for ~N test cards.
  * name_review_sheet.html  — each card image rendered next to the prediction, with
    correct/wrong radio buttons (UNFILLED — a human must complete it; we never fabricate).

Usage:
    python3 name_accuracy.py --vlm-results eval_fullcard_results_v2.json --sample 50
"""
from __future__ import annotations

import argparse
import base64
import json
import random
import re
from pathlib import Path

SCRIPT_DIR  = Path(__file__).parent
DATASET_DIR = SCRIPT_DIR / "benchmark" / "datasets" / "arabic-numbers-v2-roboflow"

# Arabic normalization ---------------------------------------------------------
_TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")  # diacritics + tatweel
_ALEF = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا",
                       "ٱ": "ا",            # آ أ إ ٱ → ا
                       "ى": "ي",            # alef-maksura ى → ي
                       "ة": "ه"})           # teh-marbuta ة → ه


def norm_ar(s: str) -> str:
    if not s:
        return ""
    s = _TASHKEEL.sub("", s)
    s = s.translate(_ALEF)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vlm-results", default="eval_fullcard_results_v2.json")
    ap.add_argument("--sample", type=int, default=50)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    data = json.load(open(SCRIPT_DIR / args.vlm_results, encoding="utf-8"))
    rows = data["rows"]["adapter"]
    n = len(rows)

    first_raw = first_norm = last_first_tok = last_full = 0
    for r in rows:
        of, gf = r["out_firstName"], r["gt_firstName"]
        ol, gl = r["out_lastName"],  r["gt_lastName"]
        if of.strip() == gf.strip():
            first_raw += 1
        if norm_ar(of) == norm_ar(gf):
            first_norm += 1
        # lastName is a chain "father grandfather ..."; check first token + full
        ont, gnt = norm_ar(ol).split(), norm_ar(gl).split()
        if ont and gnt and ont[0] == gnt[0]:
            last_first_tok += 1
        if norm_ar(ol) == norm_ar(gl):
            last_full += 1

    def pct(x): return 100.0 * x / n if n else 0.0
    print(f"\n{'='*64}")
    print(f"  NAME ACCURACY — agreement with 7B-teacher label (n={n})")
    print(f"  NOTE: label is the 7B teacher's UNVERIFIED guess, NOT human truth.")
    print(f"        These are agreement-with-teacher, not true accuracy.")
    print(f"{'='*64}")
    print(f"  firstName exact (raw)            : {pct(first_raw):5.1f}%  ({first_raw}/{n})")
    print(f"  firstName exact (Arabic-norm)    : {pct(first_norm):5.1f}%  ({first_norm}/{n})")
    print(f"  lastName first-token (norm)      : {pct(last_first_tok):5.1f}%  ({last_first_tok}/{n})")
    print(f"  lastName full-chain exact (norm) : {pct(last_full):5.1f}%  ({last_full}/{n})")
    print(f"\n  (cf. PLAUSIBILITY metrics in eval_fullcard_results: non-empty 100%, "
          f"gaz-hit 55.9% — these OVERSTATE correctness.)\n")

    metrics = {
        "n": n,
        "caveat": "Agreement with the 7B-teacher label (UNVERIFIED). NOT human-verified accuracy.",
        "firstName_exact_raw": pct(first_raw) / 100,
        "firstName_exact_norm": pct(first_norm) / 100,
        "lastName_first_token_norm": pct(last_first_tok) / 100,
        "lastName_full_chain_norm": pct(last_full) / 100,
    }

    # ── Human review sheet ────────────────────────────────────────────────────
    rng = random.Random(args.seed)
    sample = rng.sample(rows, min(args.sample, n))
    sheet = [{"image": r["image"],
              "pred_firstName": r["out_firstName"],
              "pred_lastName": r["out_lastName"],
              "teacher_firstName": r["gt_firstName"],
              "teacher_lastName": r["gt_lastName"],
              "human_firstName_correct": None,   # to be filled by a human
              "human_lastName_correct": None}
             for r in sample]
    json.dump({"metrics": metrics, "review": sheet},
              open(SCRIPT_DIR / "name_review_sheet.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    # HTML with embedded images so a human can eyeball card vs prediction.
    cards = []
    for i, r in enumerate(sample):
        p = DATASET_DIR / r["image"]
        try:
            b64 = base64.b64encode(p.read_bytes()).decode()
            img = f'<img src="data:image/jpeg;base64,{b64}" style="max-width:480px;border:1px solid #ccc">'
        except Exception:
            img = f'<i>missing image: {r["image"]}</i>'
        cards.append(f"""
        <div class="card">
          <div class="n">#{i+1}</div>
          {img}
          <table>
            <tr><th></th><th>prediction (v2 VLM)</th><th>7B-teacher label (unverified)</th><th>human verdict</th></tr>
            <tr><td>firstName</td><td dir="rtl" class="pred">{r['out_firstName']}</td>
                <td dir="rtl">{r['gt_firstName']}</td>
                <td><label><input type="radio" name="f{i}"> correct</label>
                    <label><input type="radio" name="f{i}"> wrong</label></td></tr>
            <tr><td>lastName</td><td dir="rtl" class="pred">{r['out_lastName']}</td>
                <td dir="rtl">{r['gt_lastName']}</td>
                <td><label><input type="radio" name="l{i}"> correct</label>
                    <label><input type="radio" name="l{i}"> wrong</label></td></tr>
          </table>
        </div>""")
    html = f"""<!doctype html><html><head><meta charset="utf-8">
    <title>NID name review — v2 predictions ({len(sample)} held-out cards)</title>
    <style>
      body{{font-family:sans-serif;max-width:1000px;margin:auto;padding:20px}}
      .card{{border-bottom:2px solid #eee;padding:18px 0}}
      .n{{font-weight:bold;color:#888}}
      table{{border-collapse:collapse;margin-top:8px}} td,th{{border:1px solid #ddd;padding:6px 10px}}
      .pred{{font-weight:bold}}
      .warn{{background:#fff3cd;padding:12px;border:1px solid #ffe69c;border-radius:6px}}
    </style></head><body>
    <h1>Name accuracy — human review</h1>
    <div class="warn"><b>Why this sheet exists:</b> non-empty% and gazetteer-hit% measure
    plausibility, not correctness. The "teacher label" is the 7B model's UNVERIFIED guess.
    Mark each prediction correct/wrong by reading the card image. This is the only source
    of a TRUE name-accuracy number. (Verdicts are NOT pre-filled — nothing is fabricated.)</div>
    {''.join(cards)}
    </body></html>"""
    (SCRIPT_DIR / "name_review_sheet.html").write_text(html, encoding="utf-8")
    print(f"  Review sheet → name_review_sheet.json  +  name_review_sheet.html "
          f"({len(sample)} cards, human verdicts UNFILLED)\n")


if __name__ == "__main__":
    main()
