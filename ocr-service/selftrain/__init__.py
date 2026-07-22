"""
Self-training proof (Phase 0 core) — checksum-grounded auto-labelling.

The thesis: a document's own checksum is a free, high-precision auto-labeller.
This package proves the engine on SYNTHETIC data where every answer is known:

  generate valid-checksummed NIDs -> render to images (perfect GT) ->
  deliberately WEAKEN a digit extractor -> read the unlabeled pool ->
  keep ONLY verifier(checksum)-passing reads as pseudo-labels -> RETRAIN ->
  re-measure on a FROZEN held-out slice (never trained on).

Claim to demonstrate (plan §6 Phase 0, §7 metrics):
  * full-number accuracy ↑ and confident-error rate ↓ across ≥2 rounds,
  * held-out slice never leaks into training,
  * anti-gaming: checksum-valid-but-≠-GT rate among kept pseudo-labels ≈ 0.

Everything is real: a real sklearn classifier is re-fit each round on real
pixel features; the verifier really filters; the held-out eval is isolated.
CPU-only — does not touch the GPU / vLLM.
"""
