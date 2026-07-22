"""
Metrics. The HEADLINE is confident-error rate; everything else is context.

Per sample (with GT for a field) we bucket the prediction:
  CONFIDENT_CORRECT : emitted, confident, correct   (good)
  CONFIDENT_ERROR   : emitted, confident, wrong      (THE ENEMY)
  ABSTAINED         : not confident (didn't emit, or emitted but low-confidence)

"Confident" is decided as:
  - if a verifier/abstention verdict is attached: confident  iff verdict == ACCEPT
  - elif a confidence score is present:           confident  iff conf >= tau
  - else (raw pipeline, no abstention):           confident  := True
The last case is deliberate: a pipeline with no abstention (Wael's current one)
emits everything "confidently", so its confident-error rate == its raw error
rate. That is the honest baseline that exposes the fill-rate blind spot.

Verifier catch-rate / false-alarm-rate treat the verifier as a wrongness
detector on the NID: of WRONG predictions, how many it REJECTs (catch); of
CORRECT predictions, how many it wrongly REJECTs (false alarm).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .schema import Prediction, GroundTruth, FieldPred
from .compare import is_correct, cer, normalize_nid


def _is_confident(pred: FieldPred, verdict: str | None, tau: float) -> bool:
    if verdict is not None:
        return verdict == "ACCEPT"
    if pred.confidence is not None:
        return pred.confidence >= tau
    return True  # no abstention signal => everything is a confident emission


@dataclass
class FieldScore:
    field_key: str
    n: int = 0                       # samples with GT for this field
    emitted: int = 0
    correct: int = 0                 # emitted & correct
    confident: int = 0               # emitted & confident
    confident_correct: int = 0
    confident_error: int = 0         # emitted & confident & wrong  (THE ENEMY)
    abstained: int = 0               # n - confident
    mean_cer: float = 0.0            # text fields only (names)

    @property
    def fill_rate(self) -> float:    # NOT correctness — kept to make the point
        return self.emitted / self.n if self.n else 0.0

    @property
    def accuracy_over_emitted(self) -> float:
        return self.correct / self.emitted if self.emitted else 0.0

    @property
    def accuracy_over_all(self) -> float:
        return self.correct / self.n if self.n else 0.0

    @property
    def confident_error_rate(self) -> float:        # HEADLINE
        return self.confident_error / self.n if self.n else 0.0

    @property
    def abstention_rate(self) -> float:
        return self.abstained / self.n if self.n else 0.0

    @property
    def confident_precision(self) -> float:
        c = self.confident_correct + self.confident_error
        return self.confident_correct / c if c else 0.0

    def to_dict(self) -> dict:
        return {
            "field": self.field_key, "n": self.n,
            "fill_rate_NOT_correctness": round(self.fill_rate, 4),
            "accuracy_over_emitted": round(self.accuracy_over_emitted, 4),
            "accuracy_over_all": round(self.accuracy_over_all, 4),
            "confident_error_rate": round(self.confident_error_rate, 4),
            "abstention_rate": round(self.abstention_rate, 4),
            "confident_precision": round(self.confident_precision, 4),
            "confident_correct": self.confident_correct,
            "confident_error": self.confident_error,
            "mean_cer": round(self.mean_cer, 4),
        }


@dataclass
class VerifierDetectorScore:
    n_emitted_nid: int = 0
    n_wrong: int = 0
    n_correct: int = 0
    wrong_rejected: int = 0          # caught
    correct_rejected: int = 0        # false alarm

    @property
    def catch_rate(self) -> float:
        return self.wrong_rejected / self.n_wrong if self.n_wrong else float("nan")

    @property
    def false_alarm_rate(self) -> float:
        return self.correct_rejected / self.n_correct if self.n_correct else float("nan")

    def to_dict(self) -> dict:
        return {
            "n_emitted_nid": self.n_emitted_nid,
            "n_wrong": self.n_wrong, "n_correct": self.n_correct,
            "catch_rate": round(self.catch_rate, 4) if self.n_wrong else None,
            "false_alarm_rate": round(self.false_alarm_rate, 4) if self.n_correct else None,
        }


@dataclass
class DatasetScore:
    fields: dict[str, FieldScore] = field(default_factory=dict)
    verifier_detector: VerifierDetectorScore | None = None
    n_samples: int = 0
    tau: float = 0.90

    def to_dict(self) -> dict:
        return {
            "n_samples": self.n_samples,
            "tau": self.tau,
            "fields": {k: v.to_dict() for k, v in self.fields.items()},
            "verifier_detector_nid": (
                self.verifier_detector.to_dict() if self.verifier_detector else None),
        }


def score_field(
    field_key: str,
    predictions: dict[str, Prediction],
    ground_truth: dict[str, GroundTruth],
    tau: float = 0.90,
) -> FieldScore:
    fs = FieldScore(field_key=field_key)
    cers: list[float] = []
    text_field = field_key in ("full_name", "first_name", "last_name")
    for sid, gt in ground_truth.items():
        truth = gt.get(field_key)
        if truth == "":
            continue                 # no GT for this field on this sample
        fs.n += 1
        pred = predictions.get(sid)
        fp = pred.get(field_key) if pred else FieldPred(value="", emitted=False)
        verdict = pred.verdict if pred else None
        emitted = fp.emitted and fp.value != ""
        confident = emitted and _is_confident(fp, verdict, tau)
        correct = emitted and is_correct(field_key, fp.value, truth)

        if emitted:
            fs.emitted += 1
            if text_field:
                cers.append(cer(fp.value, truth))
        if correct:
            fs.correct += 1
        if confident:
            fs.confident += 1
            if correct:
                fs.confident_correct += 1
            else:
                fs.confident_error += 1
    fs.abstained = fs.n - fs.confident
    fs.mean_cer = sum(cers) / len(cers) if cers else 0.0
    return fs


def score_verifier_detector(
    predictions: dict[str, Prediction],
    ground_truth: dict[str, GroundTruth],
    verifier=None,
) -> VerifierDetectorScore:
    """Treat the verifier as a wrongness detector on the predicted NID:
    of emitted NID predictions, how often it REJECTs wrong vs correct ones."""
    if verifier is None:
        from verifier import NIDVerifier
        verifier = NIDVerifier()
    vd = VerifierDetectorScore()
    for sid, gt in ground_truth.items():
        truth = gt.get("national_id")
        if truth == "":
            continue
        pred = predictions.get(sid)
        if not pred:
            continue
        fp = pred.get("national_id")
        if not (fp.emitted and fp.value != ""):
            continue
        vd.n_emitted_nid += 1
        correct = is_correct("national_id", fp.value, truth)
        # build cross-field context from the prediction for the verifier
        ocr_fields = {
            "birth_date": pred.get("birth_date").value,
            "gender": pred.get("gender").value,
            "governorate": pred.get("governorate").value,
        }
        res = verifier.verify(fp.value, ocr_fields=ocr_fields,
                              ocr_confidence=fp.confidence)
        rejected = (res.verdict.value == "REJECT")
        if correct:
            vd.n_correct += 1
            if rejected:
                vd.correct_rejected += 1
        else:
            vd.n_wrong += 1
            if rejected:
                vd.wrong_rejected += 1
    return vd


def score_dataset(
    predictions: dict[str, Prediction],
    ground_truth: dict[str, GroundTruth],
    field_keys: list[str] | None = None,
    tau: float = 0.90,
    verifier=None,
    run_verifier_detector: bool = True,
) -> DatasetScore:
    if field_keys is None:
        # union of all GT field keys, NID + name first
        keys: list[str] = []
        for gt in ground_truth.values():
            for k in gt.fields:
                if k not in keys:
                    keys.append(k)
        # stable, meaningful order
        order = ["national_id", "full_name", "first_name", "last_name",
                 "birth_date", "gender", "governorate", "marital_status",
                 "occupation", "issue_date", "expiry_date"]
        field_keys = [k for k in order if k in keys] + [k for k in keys if k not in order]

    ds = DatasetScore(n_samples=len(ground_truth), tau=tau)
    for k in field_keys:
        ds.fields[k] = score_field(k, predictions, ground_truth, tau=tau)
    if run_verifier_detector and any(gt.get("national_id") for gt in ground_truth.values()):
        ds.verifier_detector = score_verifier_detector(predictions, ground_truth, verifier)
    return ds
