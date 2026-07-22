#!/usr/bin/env python3
"""
Local OCR accuracy harness — runs ID images through the real pipeline and prints
the extracted fields, so you can eyeball accuracy against real cards.

PRIVACY: images stay on your machine. Put test images in ./test-ids/ (which is
gitignored). The National ID is MASKED in output. Delete your test images when done.

Usage:
    python test_harness.py                 # process every image in ./test-ids/
    python test_harness.py path/to/dir     # custom folder
    python test_harness.py img1.jpg img2.jpg

Front vs back is chosen by filename: anything containing "back" is treated as the
card back; everything else as the front.
"""
import sys
from pathlib import Path

import server  # imports the real pipeline (models load lazily on first use)

_IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _mask_nid(nid: str) -> str:
    if not nid:
        return "(none)"
    return f"{nid[:3]}{'*' * max(0, len(nid) - 5)}{nid[-2:]}" if len(nid) >= 5 else "*" * len(nid)


def _print_front(name: str, data: dict, method: str):
    print(f"\n┌─ FRONT · {name}   [method: {method}]")
    rows = [
        ("Full name",    data.get("full_name", "")),
        ("First / second", f'{data.get("first_name","")} / {data.get("second_name","")}'),
        ("National ID",   _mask_nid(data.get("national_id", ""))),
        ("Birth date",    data.get("birth_date", "")),
        ("Governorate",   data.get("governorate", "")),
        ("Gender",        data.get("gender", "")),
        ("Address",       data.get("address", "")),
        ("Face detected", "yes" if data.get("face_image") else "no"),
    ]
    for label, val in rows:
        print(f"│  {label:<16} {val}")
    print("└" + "─" * 50)


def _print_back(name: str, data: dict):
    print(f"\n┌─ BACK · {name}")
    rows = [
        ("Serial / factory", data.get("serial_number", "")),
        ("Marital status",   data.get("marital_status", "")),
        ("Occupation",       data.get("occupation", "")),
        ("Issue date",       data.get("issue_date", "")),
        ("Expiry date",      data.get("expiry_date", "")),
    ]
    for label, val in rows:
        print(f"│  {label:<16} {val or '(not found)'}")
    print("└" + "─" * 50)


def _collect(args) -> list[Path]:
    if not args:
        folder = Path(__file__).parent / "test-ids"
        if not folder.exists():
            print(f"No folder given and {folder} does not exist.\n"
                  f"Create it, drop ID images in, and re-run. (It is gitignored.)")
            sys.exit(1)
        return sorted(p for p in folder.iterdir() if p.suffix.lower() in _IMG_EXT)
    paths: list[Path] = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            paths.extend(sorted(q for q in p.iterdir() if q.suffix.lower() in _IMG_EXT))
        elif p.exists():
            paths.append(p)
        else:
            print(f"Skipping (not found): {a}")
    return paths


def main():
    images = _collect(sys.argv[1:])
    if not images:
        print("No images found.")
        return
    print(f"Running {len(images)} image(s) through the OCR pipeline…")
    for img in images:
        try:
            if "back" in img.name.lower():
                result = server.run_back_ocr(str(img))
                _print_back(img.name, result["extracted_data"])
            else:
                result = server.run_front_ocr(str(img))
                _print_front(img.name, result["extracted_data"], result["method"])
        except Exception as exc:  # noqa: BLE001 — harness should never crash mid-batch
            print(f"\n[ERROR] {img.name}: {exc}")
    print("\nDone. Remember to delete ./test-ids/ images when finished.")


if __name__ == "__main__":
    main()
