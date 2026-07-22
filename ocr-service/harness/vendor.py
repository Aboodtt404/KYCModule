"""
Commercial-vendor reference oracle — the SECOND independent proof (plan §7).

We do not ship a vendor key. But the CODE PATH is real: given a vendor adapter
and images, it calls the vendor, parses its NID, and computes our-vs-vendor
agreement + (if GT present) the vendor's own accuracy — a genuine second oracle.
Without a key/adapter configured, it returns status='skipped (no key)' and the
harness records the block as unavailable, never fabricating numbers.

To enable: implement/select an adapter and set its env var, e.g.
    KYC_VENDOR=idanalyzer KYC_VENDOR_KEY=...   (adapter calls the real API)
The adapter contract is `VendorAdapter.read_nid(image_path) -> (nid, confidence)`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from .schema import GroundTruth, Prediction
from .compare import normalize_nid, is_correct


class VendorAdapter:
    """Interface a concrete vendor implements. read_nid must make a REAL call."""
    name = "abstract"

    def read_nid(self, image_path: str) -> tuple[str, float | None]:
        raise NotImplementedError


class IDAnalyzerAdapter(VendorAdapter):
    """Concrete adapter for the IDAnalyzer REST API (representative vendor).

    Real HTTP call; only runs when KYC_VENDOR_KEY is set. The exact field path
    may need adjusting per the vendor's current schema — kept honest: if the
    response shape is unexpected it returns ('', None), it does not invent data.
    """
    name = "idanalyzer"
    endpoint = "https://api.idanalyzer.com/"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def read_nid(self, image_path: str) -> tuple[str, float | None]:
        import base64, json, urllib.request, urllib.parse
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        data = urllib.parse.urlencode({
            "apikey": self.api_key, "document": b64, "country": "EG",
        }).encode()
        try:
            req = urllib.request.Request(self.endpoint, data=data)
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = json.loads(resp.read().decode())
        except Exception:
            return "", None
        # vendor schemas vary; probe the common locations honestly
        for key in ("documentNumber", "personalNumber", "national_id"):
            v = payload.get("result", {}).get(key) if isinstance(payload.get("result"), dict) else payload.get(key)
            if v:
                return normalize_nid(str(v)), payload.get("confidence")
        return "", None


def get_adapter() -> VendorAdapter | None:
    """Return a configured adapter from env, or None if no key present."""
    key = os.environ.get("KYC_VENDOR_KEY")
    if not key:
        return None
    vendor = os.environ.get("KYC_VENDOR", "idanalyzer").lower()
    if vendor == "idanalyzer":
        return IDAnalyzerAdapter(key)
    return None


def run_vendor_oracle(
    ground_truth: dict[str, GroundTruth],
    our_predictions: dict[str, Prediction],
    adapter: VendorAdapter | None = None,
) -> dict:
    """Run the vendor over the benchmark images and compute:
      - our-vs-vendor NID agreement
      - vendor accuracy vs GT (when GT NID present)
    Returns a block for the scorecard. status reflects whether a real call ran.
    """
    adapter = adapter or get_adapter()
    if adapter is None:
        return {
            "vendor": os.environ.get("KYC_VENDOR", "idanalyzer"),
            "status": "skipped (no KYC_VENDOR_KEY) — code path real, run with a key",
            "agreement_nid": None, "vendor_accuracy_nid": None, "n_compared": 0,
        }
    n_cmp = agree = vendor_correct = vendor_judged = 0
    for sid, gt in ground_truth.items():
        if not gt.image_path:
            continue
        vendor_nid, _conf = adapter.read_nid(gt.image_path)
        if not vendor_nid:
            continue
        n_cmp += 1
        our = our_predictions.get(sid)
        our_nid = normalize_nid(our.get("national_id").value) if our else ""
        if our_nid and our_nid == vendor_nid:
            agree += 1
        if gt.get("national_id"):
            vendor_judged += 1
            if is_correct("national_id", vendor_nid, gt.get("national_id")):
                vendor_correct += 1
    return {
        "vendor": adapter.name,
        "status": "ran",
        "n_compared": n_cmp,
        "agreement_nid": (agree / n_cmp) if n_cmp else None,
        "vendor_accuracy_nid": (vendor_correct / vendor_judged) if vendor_judged else None,
    }
