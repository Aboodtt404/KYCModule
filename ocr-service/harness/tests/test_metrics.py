"""
Harness tests, incl. the RED-ABLE positive control: corrupting a ground-truth
label must change the verdict the harness reports (a previously-correct,
confident prediction must become a confident ERROR). If the harness silently
kept reporting "correct", it wouldn't be measuring against GT.
"""
import copy

from verifier.checksum import check_digit
from harness.schema import Prediction, GroundTruth, FieldPred
from harness.metrics import score_field, score_dataset, score_verifier_detector


def _valid_nid(prefix13: str) -> str:
    return prefix13 + str(check_digit(prefix13))


NID_A = _valid_nid("2920429240021")   # = 29204292400211 (real-back prefix)
NID_B = _valid_nid("3001224019993")   # = 30012240199931


def _gt(sid, nid, name="محمد علي حسن"):
    return GroundTruth(sample_id=sid, fields={"national_id": nid, "full_name": name})


def _pred(sid, nid, conf=0.99, name="محمد علي حسن", verdict=None):
    return Prediction(sample_id=sid, verdict=verdict, fields={
        "national_id": FieldPred(value=nid, confidence=conf),
        "full_name": FieldPred(value=name, confidence=conf),
    })


def test_perfect_predictions_zero_confident_error():
    gt = {"s1": _gt("s1", NID_A), "s2": _gt("s2", NID_B)}
    preds = {"s1": _pred("s1", NID_A), "s2": _pred("s2", NID_B)}
    fs = score_field("national_id", preds, gt)
    assert fs.n == 2
    assert fs.confident_error == 0
    assert fs.confident_error_rate == 0.0
    assert fs.accuracy_over_all == 1.0


def test_positive_control_corrupting_gt_makes_harness_go_red():
    """Same predictions; corrupt ONE GT label -> a confident error must appear."""
    gt = {"s1": _gt("s1", NID_A), "s2": _gt("s2", NID_B)}
    preds = {"s1": _pred("s1", NID_A), "s2": _pred("s2", NID_B)}

    clean = score_field("national_id", preds, gt)
    assert clean.confident_error == 0

    # corrupt the GT for s1 (different valid number) — prediction now disagrees
    gt_bad = copy.deepcopy(gt)
    gt_bad["s1"].fields["national_id"] = NID_B
    dirty = score_field("national_id", preds, gt_bad)
    assert dirty.confident_error == 1, "harness failed to catch the GT/prediction mismatch"
    assert dirty.confident_error_rate > clean.confident_error_rate


def test_confident_wrong_is_the_enemy_metric():
    # prediction is WRONG (NID_B) but emitted with high confidence -> confident error
    gt = {"s1": _gt("s1", NID_A)}
    preds = {"s1": _pred("s1", NID_B, conf=0.99)}
    fs = score_field("national_id", preds, gt)
    assert fs.confident_error == 1
    assert fs.abstained == 0


def test_low_confidence_wrong_is_abstention_not_confident_error():
    gt = {"s1": _gt("s1", NID_A)}
    preds = {"s1": _pred("s1", NID_B, conf=0.10)}   # wrong, but NOT confident
    fs = score_field("national_id", preds, gt, tau=0.90)
    assert fs.confident_error == 0
    assert fs.abstained == 1
    assert fs.abstention_rate == 1.0


def test_verdict_abstain_overrides_high_confidence():
    gt = {"s1": _gt("s1", NID_A)}
    # high field confidence, but the pipeline's verifier said ABSTAIN
    preds = {"s1": _pred("s1", NID_B, conf=0.99, verdict="ABSTAIN")}
    fs = score_field("national_id", preds, gt)
    assert fs.confident_error == 0
    assert fs.abstained == 1


def test_fill_rate_is_not_correctness():
    """A pipeline that emits a WRONG number on every sample has fill-rate 100%
    yet is 0% correct — the exact blind spot the harness exists to expose."""
    gt = {f"s{i}": _gt(f"s{i}", NID_A) for i in range(10)}
    preds = {f"s{i}": _pred(f"s{i}", NID_B, conf=0.99) for i in range(10)}  # all wrong
    fs = score_field("national_id", preds, gt)
    assert fs.fill_rate == 1.0
    assert fs.accuracy_over_emitted == 0.0
    assert fs.confident_error_rate == 1.0


def test_verifier_detector_catches_wrong_misses_correct():
    """Verifier should REJECT a checksum-broken NID (catch) and pass a valid one."""
    # s_wrong: a single-digit-corrupted NID that actually BREAKS the checksum
    # (avoid the documented {0,10}-collapse blind spot by searching for one).
    from verifier.checksum import is_valid_checksum
    bad = None
    for pos in range(14):
        for repl in "0123456789":
            cand = NID_A[:pos] + repl + NID_A[pos + 1:]
            if cand != NID_A and not is_valid_checksum(cand):
                bad = cand
                break
        if bad:
            break
    assert bad is not None and not is_valid_checksum(bad)
    gt = {"sc": _gt("sc", NID_A), "sw": _gt("sw", NID_A)}
    preds = {
        "sc": _pred("sc", NID_A),      # correct
        "sw": _pred("sw", bad),        # wrong (checksum-broken)
    }
    vd = score_verifier_detector(preds, gt)
    assert vd.n_wrong == 1 and vd.n_correct == 1
    assert vd.catch_rate == 1.0          # caught the wrong one
    assert vd.false_alarm_rate == 0.0    # did not reject the correct one


def test_score_dataset_end_to_end():
    gt = {"s1": _gt("s1", NID_A), "s2": _gt("s2", NID_B)}
    preds = {"s1": _pred("s1", NID_A), "s2": _pred("s2", NID_B)}
    ds = score_dataset(preds, gt)
    assert "national_id" in ds.fields
    assert ds.fields["national_id"].confident_error_rate == 0.0
    assert ds.verifier_detector is not None
    from harness.scorecard import build_scorecard, render_scorecard
    sc = build_scorecard(ds, title="test")
    assert sc["HEADLINE"]["confident_error_rate__national_id"] == 0.0
    txt = render_scorecard(sc)
    assert "confident-error rate" in txt
