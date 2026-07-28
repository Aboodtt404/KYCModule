"""detfirst_rules.py — geometry+content field assignment over PP det+rec lines.

No trained field model: the card layout is self-identifying. The NID row is the
longest digit run in the lower half (checksum-window scan, Arabic-Indic native);
the header is keyword- or geometry-identified (centered/wide/top); the remaining
right-column Arabic lines top→bottom are firstName / lastName / address; the
serial is the Latin line below the NID row.

Benchmarked 2026-07-28 (content-fair): real office captures 5/5 fields perfect;
TRAIN-val 200 cards ~80/74/67; NID checksum-valid 96% on frozen TEST (vs the
digit-YOLO path which cannot read Arabic-Indic NIDs at all).

Synced with the research prototype /home/abdelrahman/kyc-bakeoff/detfirst.py —
tune THERE against TRAIN gold, then copy rule changes here.
"""
from __future__ import annotations

import re

import cv2

AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
HEADER = re.compile(r"[جحه]مهو|مه?ور|بطا[قف]|ت[حه][قف]ي[قف]|الشخصي|العرب")
ARABIC = re.compile(r"[؀-ۿ]")
LATIN_JUNK = re.compile(r"^[A-Za-z0-9 .\-]+$")

_WEIGHTS = [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]


def checksum_ok(nid: str) -> bool:
    if len(nid) != 14 or not nid.isdigit():
        return False
    s = sum(int(d) * w for d, w in zip(nid[:13], _WEIGHTS))
    k = 11 - (s % 11)
    k = 0 if k == 10 else (1 if k == 11 else k)
    return int(nid[13]) == k


def nid_from_digits(s: str):
    """Best 14-digit window: checksum-valid preferred, else first structural."""
    first = None
    for i in range(max(0, len(s) - 13)):
        w = s[i:i + 14]
        if not re.fullmatch(r"[23]\d{13}", w):
            continue
        if checksum_ok(w):
            return w, True
        if first is None:
            first = w
    return first, False


def lines_of(res, W, H):
    texts = res.get("rec_texts") or []
    boxes = res.get("rec_boxes")
    if boxes is None:
        boxes = [[min(p[0] for p in poly), min(p[1] for p in poly),
                  max(p[0] for p in poly), max(p[1] for p in poly)]
                 for poly in (res.get("rec_polys") or [])]
    out = []
    for b, t in zip(boxes, texts):
        t = t.strip()
        if not t:
            continue
        x0, y0, x1, y1 = [float(v) for v in list(b)]
        out.append({"t": t, "xc": (x0 + x1) / 2 / W, "yc": (y0 + y1) / 2 / H,
                    "w": (x1 - x0) / W, "h": (y1 - y0) / H,
                    "y0": y0 / H, "y1": y1 / H})
    out.sort(key=lambda l: l["yc"])
    return out


def merge_rows(lines, tol=0.6):
    """Group det lines that sit on the same text row (split detections)."""
    rows = []
    for l in lines:
        for row in rows:
            ry = sum(m["yc"] for m in row) / len(row)
            rh = sum(m["h"] for m in row) / len(row)
            if abs(l["yc"] - ry) < tol * max(l["h"], rh):
                row.append(l)
                break
        else:
            rows.append([l])
    merged = []
    for row in rows:
        row.sort(key=lambda m: -m["xc"])          # RTL within the row
        merged.append({
            "t": " ".join(m["t"] for m in row),
            "xc": sum(m["xc"] * m["w"] for m in row) / max(sum(m["w"] for m in row), 1e-6),
            "yc": sum(m["yc"] for m in row) / len(row),
            "w": sum(m["w"] for m in row),
            "h": max(m["h"] for m in row),
            "y0": min(m.get("y0", m["yc"] - m["h"] / 2) for m in row),
        })
    return merged


def assign(lines):
    """Geometry+content rules -> field dict (see module docstring)."""
    rows = merge_rows(lines)
    out = {"firstName": "", "lastName": "", "address": "", "nid": "",
           "nid_checksum": False, "serial": "", "dob_text": ""}

    # 1. NID row: most digits, lower half
    best_row, best_digits = None, ""
    for r in rows:
        digs = re.sub(r"\D", "", r["t"].translate(AR_DIGITS))
        if r["yc"] > 0.5 and len(digs) > len(best_digits):
            best_row, best_digits = r, digs
    nid_y = 0.80
    if best_row is not None and len(best_digits) >= 12:
        nid_y = best_row["yc"]
        nid, ok = nid_from_digits(best_digits)
        if nid:
            out["nid"], out["nid_checksum"] = nid, ok

    # 2. candidate field rows: Arabic, between header zone and the NID row
    cands = []
    for r in rows:
        if best_row is not None and r is best_row:
            continue
        if not ARABIC.search(r["t"]):
            if LATIN_JUNK.match(r["t"]) and r["yc"] > nid_y and len(r["t"]) >= 6:
                out["serial"] = out["serial"] or re.sub(r"[^A-Za-z0-9]", "", r["t"]).upper()
            continue
        digs = re.sub(r"\D", "", r["t"].translate(AR_DIGITS))
        if r["yc"] >= nid_y - 0.04:
            if len(digs) >= 6 and r["xc"] < 0.5:
                out["dob_text"] = r["t"]
            continue
        # Header: keyword when rec is clean, GEOMETRY when it garbles (low-res
        # rec turns the header into noise no regex catches). The header is
        # centered and wide; names are right-aligned and narrow.
        if r["yc"] < 0.30 and (HEADER.search(r["t"]) or r["xc"] < 0.74 or r["w"] > 0.34):
            continue
        if HEADER.search(r["t"]) and r["yc"] < 0.40:
            continue
        if len(digs) >= max(4, len(re.sub(r"\s", "", r["t"])) - 2):
            continue  # digit-dominated stray (partial nid echo)
        if r["w"] < 0.04 and len(r["t"]) <= 2:
            continue  # speck
        cands.append(r)

    def ar_only(text):
        """Names are pure Arabic — drop Latin/digit junk tokens the det picked up."""
        return " ".join(t for t in text.split()
                        if ARABIC.search(t) and not re.search(r"[A-Za-z0-9]", t))

    cands.sort(key=lambda r: r["yc"])

    # Shift-guard: PP det misses the tiny firstName word on low-res cards, which
    # would shift every field up one line. A real firstName line is 1-2 tokens
    # and narrow — if line 1 looks like a family name, mark firstName MISSED.
    fn_missing = False
    if cands:
        t0 = ar_only(cands[0]["t"])
        if len(t0.split()) >= 3 or cands[0]["w"] > 0.30:
            fn_missing = True

    if cands and not fn_missing:
        out["firstName"] = ar_only(cands[0]["t"])
        rest = cands[1:]
    else:
        rest = cands
        if cands:
            out["fn_line_y0"] = cands[0].get("y0", cands[0]["yc"] - cands[0]["h"] / 2)
            out["fn_line_h"] = cands[0]["h"]
    if rest:
        out["lastName"] = ar_only(rest[0]["t"])
    if len(rest) > 1:
        out["address"] = " ".join(
            t for r in rest[1:] for t in r["t"].split()
            if ARABIC.search(t))  # addresses may carry Arabic-Indic digits
    return out


def extract(img, ocr, upscale_below=1200):
    """Full det-first extraction: predict -> assign, with 2x upscale for small
    cards (det misses one-word lines at low res) and a firstName ZONE rescue —
    when the shift-guard says the firstName line was missed, crop the band just
    above the lastName line and read it directly."""
    H, W = img.shape[:2]
    if W < upscale_below:
        img = cv2.resize(img, (W * 2, H * 2), interpolation=cv2.INTER_LANCZOS4)
        H, W = img.shape[:2]
    res = ocr.predict(img)[0]
    lines = lines_of(res, W, H)
    out = assign(lines)
    if not out["firstName"] and out.get("fn_line_h"):
        y1 = int(out["fn_line_y0"] * H)
        y0 = max(0, y1 - int(out["fn_line_h"] * H * 1.7))
        band = img[y0:y1, int(0.38 * W):int(0.99 * W)]
        if band.size:
            bh = band.shape[0]
            if bh and bh < 96:
                s = 96 / bh
                band = cv2.resize(band, (int(band.shape[1] * s), 96),
                                  interpolation=cv2.INTER_LANCZOS4)
            r2 = ocr.predict(band)[0]
            texts = [t.strip() for t in (r2.get("rec_texts") or []) if t and t.strip()]
            cand = " ".join(t for t in texts if ARABIC.search(t)
                            and not re.search(r"[A-Za-z0-9]", t))
            if cand and not HEADER.search(cand) and len(cand.split()) <= 2:
                out["firstName"] = cand
    out.pop("fn_line_y0", None)
    out.pop("fn_line_h", None)
    return out
