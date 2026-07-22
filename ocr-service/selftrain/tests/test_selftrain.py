"""
Self-training proof, asserted as a fast experiment. The acceptance criteria
(mission C / plan §6 Phase-0, §7) are encoded as assertions so the proof is
reproducible and red-able:

  * accuracy ↑ across ≥2 rounds (held-out, never trained on),
  * confident-error ↓ across rounds (the no-verifier ablation),
  * the verifier keeps confident-error-with-verifier low,
  * anti-gaming: checksum-valid-but-≠-GT (pseudo-label error) stays low,
  * leakage == 0,
  * ABLATION: removing the verifier (checksum) filter wrecks pseudo-label
    precision — proving the verifier, not mere retraining, is the engine.

Fast config (smaller than the canonical benchmark run) — still exhibits the
trend because the regime is the same.
"""
import pytest

from selftrain.experiment import run_experiment


@pytest.fixture(scope="module")
def proof():
    return run_experiment(
        rounds=2, n_heldout=150, n_seed=50, n_pool=700,
        noise=0.025, pseudo_gate=0.85, max_pseudo_per_round=220,
        verbose=False,
    )


def test_no_leakage(proof):
    assert proof["leakage_check"]["heldout_in_seed"] == 0
    assert proof["leakage_check"]["heldout_in_pool"] == 0


def test_accuracy_increases_across_rounds(proof):
    accs = [r["full_number_accuracy"] for r in proof["rounds"]]
    assert accs[-1] > accs[0] + 0.05, f"accuracy did not rise: {accs}"
    # and per-digit improves too
    pds = [r["per_digit_accuracy"] for r in proof["rounds"]]
    assert pds[-1] > pds[0], f"per-digit accuracy did not rise: {pds}"


def test_confident_error_decreases(proof):
    """No-verifier confident-error (= error rate) must fall as accuracy rises."""
    ce = [r["confident_error_no_verifier"] for r in proof["rounds"]]
    assert ce[-1] < ce[0] - 0.05, f"confident-error did not fall: {ce}"


def test_verifier_keeps_confident_error_low(proof):
    """With the verifier, confident-wrong reads that still pass checksum stay low."""
    cev = [r["confident_error_with_verifier"] for r in proof["rounds"]]
    assert max(cev) <= 0.12, f"verifier-gated confident-error too high: {cev}"


def test_anti_gaming_pseudo_label_precision_high(proof):
    """checksum-valid-but-≠-GT among kept pseudo-labels must be low (~0)."""
    assert proof["anti_gaming_max_pseudo_label_error_rate"] <= 0.10


def test_verifier_filter_ablation_is_the_engine():
    """RED-ABLE CONTROL: drop the checksum filter (keep on confidence alone).
    Pseudo-label precision must collapse vs the verifier-filtered run — proving
    the verifier is what makes the pseudo-labels trustworthy."""
    common = dict(rounds=1, n_heldout=120, n_seed=50, n_pool=700,
                  noise=0.025, pseudo_gate=0.85, max_pseudo_per_round=300,
                  verbose=False)
    with_ver = run_experiment(use_verifier_filter=True, **common)
    no_ver = run_experiment(use_verifier_filter=False, **common)
    pe_with = with_ver["anti_gaming_max_pseudo_label_error_rate"]
    pe_without = no_ver["anti_gaming_max_pseudo_label_error_rate"]
    assert pe_without > pe_with + 0.05, (
        f"verifier filter made no difference to pseudo-label precision: "
        f"with={pe_with:.3f} without={pe_without:.3f}")
