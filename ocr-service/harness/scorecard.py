"""
Assemble + render the §7 scorecard. The headline is confident-error rate.

The renderer deliberately prints fill-rate in a separate, de-emphasised column
labelled "(NOT correctness)" right next to confident-error rate, so the contrast
that Wael's pipeline misses is impossible to overlook.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from .metrics import DatasetScore


def build_scorecard(
    ds: DatasetScore,
    title: str = "KYC extraction scorecard",
    provenance: str = "",
    vendor_block: dict | None = None,
    extra: dict | None = None,
) -> dict:
    nid = ds.fields.get("national_id")
    name = ds.fields.get("full_name") or ds.fields.get("first_name")
    headline = {
        "confident_error_rate__national_id": (
            round(nid.confident_error_rate, 4) if nid else None),
        "full_number_accuracy_over_emitted": (
            round(nid.accuracy_over_emitted, 4) if nid else None),
        "full_number_accuracy_over_all": (
            round(nid.accuracy_over_all, 4) if nid else None),
        "name_accuracy_over_emitted": (
            round(name.accuracy_over_emitted, 4) if name else None),
        "abstention_rate__national_id": (
            round(nid.abstention_rate, 4) if nid else None),
    }
    return {
        "title": title,
        "provenance": provenance,
        "tau_confidence_threshold": ds.tau,
        "n_samples": ds.n_samples,
        "HEADLINE": headline,
        "verifier_detector_nid": (
            ds.verifier_detector.to_dict() if ds.verifier_detector else None),
        "per_field": {k: v.to_dict() for k, v in ds.fields.items()},
        "vendor_reference_oracle": vendor_block,
        "extra": extra or {},
        "note": ("HEADLINE metric is confident_error_rate (emitted + confident + "
                 "wrong). fill_rate is reported per-field but is NOT correctness."),
    }


def _fmt(x, pct=False):
    if x is None:
        return "  n/a "
    if isinstance(x, float):
        return f"{x*100:5.1f}%" if pct else f"{x:.4f}"
    return str(x)


def render_scorecard(sc: dict) -> str:
    L = []
    L.append("=" * 78)
    L.append(sc["title"])
    if sc.get("provenance"):
        L.append(f"provenance: {sc['provenance']}")
    L.append(f"n_samples={sc['n_samples']}   tau(confidence)={sc['tau_confidence_threshold']}")
    L.append("=" * 78)
    h = sc["HEADLINE"]
    L.append(">>> HEADLINE (the enemy is confident-wrong output) <<<")
    L.append(f"  confident-error rate (NID) : {_fmt(h['confident_error_rate__national_id'], pct=True)}   <-- drive to ~0")
    L.append(f"  full-number accuracy (emit): {_fmt(h['full_number_accuracy_over_emitted'], pct=True)}")
    L.append(f"  full-number accuracy (all) : {_fmt(h['full_number_accuracy_over_all'], pct=True)}")
    L.append(f"  name accuracy (emitted)    : {_fmt(h['name_accuracy_over_emitted'], pct=True)}")
    L.append(f"  abstention rate (NID)      : {_fmt(h['abstention_rate__national_id'], pct=True)}")
    vd = sc.get("verifier_detector_nid")
    if vd:
        cr = vd.get("catch_rate"); fa = vd.get("false_alarm_rate")
        L.append("")
        L.append("  verifier as wrongness-detector on NID:")
        L.append(f"    catch-rate (of wrong, % rejected)     : {_fmt(cr, pct=True)}   (n_wrong={vd['n_wrong']})  <-- up")
        L.append(f"    false-alarm (of correct, % rejected)  : {_fmt(fa, pct=True)}   (n_correct={vd['n_correct']})  <-- down")
    L.append("")
    L.append("-" * 78)
    L.append("per-field  (fill-rate shown but is NOT correctness):")
    hdr = f"  {'field':<16}{'n':>4} {'conf-err':>9} {'acc@emit':>9} {'abstain':>8} {'fill(NOT)':>10} {'cer':>6}"
    L.append(hdr)
    for k, frec in sc["per_field"].items():
        L.append(
            f"  {k:<16}{frec['n']:>4} "
            f"{_fmt(frec['confident_error_rate'], pct=True):>9} "
            f"{_fmt(frec['accuracy_over_emitted'], pct=True):>9} "
            f"{_fmt(frec['abstention_rate'], pct=True):>8} "
            f"{_fmt(frec['fill_rate_NOT_correctness'], pct=True):>10} "
            f"{_fmt(frec['mean_cer']):>6}")
    if sc.get("vendor_reference_oracle"):
        vb = sc["vendor_reference_oracle"]
        L.append("")
        L.append("-" * 78)
        L.append(f"vendor reference oracle ({vb.get('vendor','?')}): "
                 f"status={vb.get('status')}")
        if vb.get("agreement_nid") is not None:
            L.append(f"  our-vs-vendor NID agreement: {_fmt(vb['agreement_nid'], pct=True)} "
                     f"(n={vb.get('n_compared')})")
    if sc.get("extra"):
        L.append("")
        L.append("extra: " + json.dumps(sc["extra"], ensure_ascii=False))
    L.append("=" * 78)
    return "\n".join(L)
