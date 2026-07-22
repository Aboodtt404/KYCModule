"""
Records for the harness. A benchmark is a set of Samples; each Sample has a
GroundTruth (frozen, human-confirmed) and a Prediction (from a pipeline run).

Serialised as JSONL (one JSON object per line) so benchmarks and runs are
diff-able, append-only, and provenance-stamped.

Field model: a pipeline predicts several FIELDS (national_id, full_name,
birth_date, gender, governorate, marital_status, occupation, …). Each field
prediction carries a value, a confidence in [0,1], and an `emitted` flag — a
pipeline that abstains sets emitted=False (or value=""). The harness uses
confidence + the verifier verdict to decide whether an emission is "confident".
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path


# Canonical field keys the harness understands. Extra keys are allowed and
# scored generically as strings; these get type-aware comparison.
NID_FIELD = "national_id"
NAME_FIELDS = ("full_name", "first_name", "last_name")
DATE_FIELDS = ("birth_date", "issue_date", "expiry_date")
GENDER_FIELD = "gender"
GOV_FIELD = "governorate"


@dataclass
class FieldPred:
    value: str = ""
    confidence: float | None = None   # None => unknown confidence
    emitted: bool = True              # False => pipeline abstained on this field

    def to_dict(self) -> dict:
        return {"value": self.value, "confidence": self.confidence, "emitted": self.emitted}

    @staticmethod
    def from_any(x) -> "FieldPred":
        if isinstance(x, FieldPred):
            return x
        if isinstance(x, dict):
            return FieldPred(
                value=str(x.get("value", "")),
                confidence=x.get("confidence"),
                emitted=bool(x.get("emitted", True)) and str(x.get("value", "")) != "",
            )
        # bare string
        return FieldPred(value=str(x), emitted=str(x) != "")


@dataclass
class Prediction:
    sample_id: str
    fields: dict[str, FieldPred] = field(default_factory=dict)
    # optional verifier verdict already attached by the runner (else harness runs it)
    verdict: str | None = None
    score: float | None = None
    pipeline: str = ""               # which pipeline produced this (provenance)

    def get(self, key: str) -> FieldPred:
        return self.fields.get(key, FieldPred(value="", emitted=False))

    def to_dict(self) -> dict:
        return {
            "sample_id": self.sample_id,
            "pipeline": self.pipeline,
            "verdict": self.verdict,
            "score": self.score,
            "fields": {k: v.to_dict() for k, v in self.fields.items()},
        }

    @staticmethod
    def from_dict(d: dict) -> "Prediction":
        return Prediction(
            sample_id=str(d["sample_id"]),
            pipeline=d.get("pipeline", ""),
            verdict=d.get("verdict"),
            score=d.get("score"),
            fields={k: FieldPred.from_any(v) for k, v in d.get("fields", {}).items()},
        )


@dataclass
class GroundTruth:
    sample_id: str
    fields: dict[str, str] = field(default_factory=dict)
    image_path: str = ""
    side: str = ""                   # 'front' | 'back'
    provenance: str = ""             # 'synthetic' | 'real_consented' | 'public_dataset'
    consent: bool = False            # True only for consented real captures
    notes: str = ""

    def get(self, key: str) -> str:
        return self.fields.get(key, "")

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "GroundTruth":
        return GroundTruth(
            sample_id=str(d["sample_id"]),
            fields={k: str(v) for k, v in d.get("fields", {}).items()},
            image_path=d.get("image_path", ""),
            side=d.get("side", ""),
            provenance=d.get("provenance", ""),
            consent=bool(d.get("consent", False)),
            notes=d.get("notes", ""),
        )


def load_predictions(path: str | Path) -> dict[str, Prediction]:
    out: dict[str, Prediction] = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        p = Prediction.from_dict(json.loads(line))
        out[p.sample_id] = p
    return out


def load_ground_truth(path: str | Path) -> dict[str, GroundTruth]:
    out: dict[str, GroundTruth] = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        g = GroundTruth.from_dict(json.loads(line))
        out[g.sample_id] = g
    return out


def write_jsonl(path: str | Path, records: list) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        for r in records:
            d = r.to_dict() if hasattr(r, "to_dict") else r
            f.write(json.dumps(d, ensure_ascii=False) + "\n")
