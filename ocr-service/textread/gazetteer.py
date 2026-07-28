#!/usr/bin/env python3
"""
gazetteer.py — LEAKAGE-SAFE Egyptian name/address gazetteer + post-processing.

Sources (ZERO test leakage — none of the 220 TEST cards are ever read here):
  * train_gold.json  — Claude-vision labels of the 1381 disjoint TRAIN cards (firstName,
    fullname, address). The TEST set is the fixed 220 from fullcard_split; train_gold is the
    complement.  build_gazetteer() can EXCLUDE a held-out slice of TRAIN idxs so a threshold
    can be tuned on train-val with the val tokens absent from the gazetteer.
  * GOVERNORATES — the 27 Egyptian governorate names (public knowledge), hardcoded.

Post-processing applied to a raw v4 prediction:
  1. respace()  — split a fused token (محمودخفاجي) into known gazetteer tokens.
  2. snap()     — snap an out-of-gazetteer token to the nearest gazetteer entry within an
                  edit-distance threshold (length-gated, frequency-gated). Attacks 1-char
                  misreads and the "محمد" default-bias.
Both operate on norm_ar-normalized text and preserve token order.

Nothing here imports or reads claude_gold*.json / crop_cache (test artifacts).
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from name_accuracy import norm_ar

SCRIPT_DIR = Path(__file__).parent

# Public knowledge: 27 Egyptian governorates (normalized forms added at build time).
GOVERNORATES = [
    "القاهره", "الجيزه", "الاسكندريه", "الدقهليه", "البحيره", "الشرقيه", "المنوفيه",
    "القليوبيه", "الغربيه", "كفر الشيخ", "دمياط", "بورسعيد", "الاسماعيليه", "السويس",
    "شمال سيناء", "جنوب سيناء", "بني سويف", "الفيوم", "المنيا", "اسيوط", "سوهاج",
    "قنا", "الاقصر", "اسوان", "البحر الاحمر", "الوادي الجديد", "مطروح", "بورسعيد",
]

# Structural address keywords (public, also abundant in TRAIN).
ADDR_KEYWORDS = ["محافظه", "مركز", "قريه", "بندر", "قسم", "شياخه", "شارع", "عزبه",
                 "كفر", "نجع", "منشاه", "تابع", "ميت", "ابو", "حوض"]


def _lev(a: str, b: str) -> int:
    """Classic Levenshtein edit distance on characters."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def build_gazetteer(exclude_idxs: set[int] | None = None,
                    train_path: Path | None = None) -> dict:
    """Build the gazetteer from TRAIN cards, optionally excluding a held-out val slice.

    Returns dict with Counters:
      given   — firstName tokens
      chain   — father/family chain tokens (fullname minus the leading firstName token)
      name    — given ∪ chain (any name token may appear anywhere in the chain)
      addr    — address tokens (incl. structural keywords + governorates seeded)
    """
    exclude_idxs = exclude_idxs or set()
    train_path = train_path or (SCRIPT_DIR / "train_gold.json")
    recs = json.load(open(train_path, encoding="utf-8"))

    given, chain, addr = Counter(), Counter(), Counter()
    for r in recs:
        if r.get("idx") in exclude_idxs:
            continue
        fn = norm_ar(r.get("firstName", ""))
        full = norm_ar(r.get("fullname", ""))
        for t in fn.split():
            if t:
                given[t] += 1
        ftoks = full.split()
        # chain = everything after the first token (the father/family names)
        for t in ftoks[1:]:
            if t:
                chain[t] += 1
        for t in norm_ar(r.get("address", "")).split():
            if t:
                addr[t] += 1

    name = Counter()
    name.update(given)
    name.update(chain)

    # seed public knowledge into the address vocab (does not touch test data)
    for g in GOVERNORATES:
        for t in norm_ar(g).split():
            addr[t] += 1
    for k in ADDR_KEYWORDS:
        addr[norm_ar(k)] += 1

    return {"given": given, "chain": chain, "name": name, "addr": addr}


def _vocab(gaz: dict, kind: str) -> Counter:
    return {"firstName": gaz["given"], "lastName": gaz["name"],
            "name": gaz["name"], "address": gaz["addr"]}[kind]


def respace(token: str, vocab: Counter, min_count: int = 2) -> list[str]:
    """If `token` is OOV but splits into 2-3 known tokens, return the split; else [token]."""
    if vocab.get(token, 0) >= min_count or len(token) < 6:
        return [token]
    n = len(token)
    # try a single split point into two known tokens (prefer the most frequent split)
    best = None
    for i in range(2, n - 1):
        a, b = token[:i], token[i:]
        if vocab.get(a, 0) >= min_count and vocab.get(b, 0) >= min_count:
            score = vocab[a] + vocab[b]
            if best is None or score > best[0]:
                best = (score, [a, b])
    return best[1] if best else [token]


def snap(token: str, vocab: Counter, max_ed: int = 2, min_count: int = 3) -> str:
    """Snap an OOV token to the nearest sufficiently-frequent gazetteer entry."""
    if vocab.get(token, 0) >= 1:
        return token                                   # already a known token
    if len(token) <= 2:
        return token                                   # too short to correct safely
    # length-gated allowed distance: short tokens get ed<=1
    allowed = 1 if len(token) <= 4 else max_ed
    best_tok, best_d, best_c = token, allowed + 1, 0
    for cand, c in vocab.items():
        if c < min_count:
            continue
        if abs(len(cand) - len(token)) > allowed:
            continue
        d = _lev(token, cand)
        if d < best_d or (d == best_d and c > best_c):
            best_tok, best_d, best_c = cand, d, c
    return best_tok if best_d <= allowed else token


def correct_field(text: str, gaz: dict, kind: str,
                  max_ed: int = 2, do_respace: bool = True, do_snap: bool = True) -> str:
    """Full post-process: normalize → respace fused tokens → snap OOV tokens."""
    vocab = _vocab(gaz, kind)
    toks = norm_ar(text or "").split()
    out: list[str] = []
    for t in toks:
        parts = respace(t, vocab) if do_respace else [t]
        for p in parts:
            out.append(snap(p, vocab, max_ed=max_ed) if do_snap else p)
    return " ".join(out)


if __name__ == "__main__":
    g = build_gazetteer()
    print("Gazetteer built from train_gold.json (1381 TRAIN cards, ZERO test):")
    print(f"  given  tokens: {len(g['given']):5d}  (top: {g['given'].most_common(5)})")
    print(f"  chain  tokens: {len(g['chain']):5d}  (top: {g['chain'].most_common(5)})")
    print(f"  name   tokens: {len(g['name']):5d}")
    print(f"  addr   tokens: {len(g['addr']):5d}  (top: {g['addr'].most_common(5)})")
    # smoke tests
    print("\nSmoke:")
    print("  respace محمودخفاجي ->", correct_field("محمودخفاجي", g, "lastName"))
    print("  snap    محمـد      ->", correct_field("محمـد", g, "firstName"))
