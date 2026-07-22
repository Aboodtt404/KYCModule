#!/usr/bin/env python3
"""
Batch accuracy report — runs a folder of cardN_front / cardN_back image pairs
through the real OCR pipeline and prints per-field FILL RATES (how often each
field extracted *something*), with minimal PII in the output.

PRIVACY: values are masked/summarised, not printed in full. Images stay local.

Usage:
    python batch_report.py "/path/to/folder"
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

import server

FRONT_FIELDS = ["full_name", "national_id", "birth_date", "governorate", "gender", "address", "face_image"]
BACK_FIELDS  = ["national_id", "marital_status", "occupation", "issue_date", "expiry_date"]
_IMG = {".jpg", ".jpeg", ".png", ".webp"}


def _filled(v) -> bool:
    return bool(v) and str(v).strip() not in ("", "Unknown")


def main():
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "test-ids"
    if not folder.exists():
        print(f"Folder not found: {folder}"); sys.exit(1)

    # Group files by card id (the token before _front/_back)
    cards: dict[str, dict[str, Path]] = defaultdict(dict)
    for p in folder.iterdir():
        if p.suffix.lower() not in _IMG:
            continue
        name = p.name.lower()
        m = re.match(r"(card\s*\d+|.+?)[_\- ]*(front|back)", name)
        if not m:
            continue
        cards[m.group(1).strip()][m.group(2)] = p

    if not cards:
        print("No cardN_front / cardN_back pairs found."); sys.exit(1)

    front_hits = {f: 0 for f in FRONT_FIELDS}
    back_hits  = {f: 0 for f in BACK_FIELDS}
    n_front = n_back = 0
    errors = []

    print(f"Processing {len(cards)} cards from {folder.name!r}…\n")
    print(f"{'card':<10} {'FRONT (name nid dob gov sex addr face)':<42} {'BACK (serial marit occ issue exp)'}")
    print("-" * 92)

    for cid in sorted(cards, key=lambda s: (len(s), s)):
        sides = cards[cid]
        fmark = bmark = ""
        if "front" in sides:
            n_front += 1
            try:
                d = server.run_front_ocr(str(sides["front"]))["extracted_data"]
                fmark = " ".join("✓" if _filled(d.get(f)) else "·" for f in FRONT_FIELDS)
                for f in FRONT_FIELDS:
                    if _filled(d.get(f)): front_hits[f] += 1
            except Exception as e:  # noqa: BLE001
                fmark = "ERROR"; errors.append(f"{cid} front: {e}")
        if "back" in sides:
            n_back += 1
            try:
                d = server.run_back_ocr(str(sides["back"]))["extracted_data"]
                bmark = " ".join("✓" if _filled(d.get(f)) else "·" for f in BACK_FIELDS)
                for f in BACK_FIELDS:
                    if _filled(d.get(f)): back_hits[f] += 1
            except Exception as e:  # noqa: BLE001
                bmark = "ERROR"; errors.append(f"{cid} back: {e}")
        print(f"{cid:<10} {fmark:<42} {bmark}")

    def rate(hits, n):
        return "  ".join(f"{f.split('_')[0][:5]}:{hits[f]}/{n}" for f in hits)

    print("\n── FRONT fill-rate ──")
    print("  " + rate(front_hits, n_front))
    print("── BACK fill-rate ──")
    print("  " + rate(back_hits, n_back))
    if errors:
        print(f"\n{len(errors)} error(s):")
        for e in errors[:10]:
            print("  " + e)
    print("\n(✓ = field extracted something; · = empty. Fill ≠ correctness — spot-check a few.)")


if __name__ == "__main__":
    main()
