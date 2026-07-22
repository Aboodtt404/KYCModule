# KYC-By-Mercatura — Research Brief & Handoff (2026-07-22)

Prepared for: Abdelrahman · Prepared by: Menese DeFi Team
Project root: `/home/wael/projects/KYC-By-Mercatura` (VPS-3)

> **Access note:** the project lives under Wael's home (`drwxr-x---`, owner `wael`). You are
> on the sudo list, so read it via `sudo` (e.g. `sudo ls /home/wael/projects/KYC-By-Mercatura`)
> or ask to be added to the `wael` group for direct access. Everything referenced below is on
> THIS machine (VPS-3) unless noted.

---

## 1. What this project is

Egyptian eKYC: read + verify the Egyptian National ID (front/back), liveness, face match,
fraud/authenticity — to a publishable-research bar, not just an MVP. The scientific core of
the methodology: the Egyptian NID number carries a **check digit**, so
`[century][YYMMDD][gov][seq+gender][CHECK]` gives a **free automatic verifier**. It is used
three ways: runtime guard (reject → re-scan), harness metric (**confident-error rate** — wrong
AND confident — instead of fill-rate), and training amplifier (self-training on
verifier-passed reads). Plan-of-record: `for-team/plan-kyc-methodology-test.md`.

## 2. The story so far, and where each contributor stopped

### Wael's MVP (through late June) — the plumbing, kept
- Rust KYC canister (NID validate/dedup/audit, II admin, stable storage), SMS/OTP canister,
  6-step React flow with desktop→phone QR handoff, on-chain consent + data deletion.
- 5 trained YOLO field detectors; his front reader reads the 14-digit NID off a full front
  card at **94.9%** — kept as-is.
- Synthetic back-card generator + 32 real labeled BACK cards.
- **Where he stopped:** the assurance core was naive — "liveness" was a blur metric (not PAD),
  OCR was stock EasyOCR, no authenticity/tamper checks, no checksum validation, and tests
  measured fill-rate, not correctness. Failure mode: confident wrong reads with no signal.

### Jun-27 autonomous-worker wave (3 checkpoints in `for-team/`)
- Phase 0+1 machinery built additively (Wael's live services untouched).
- T1 digit reader trained on consented data and **proven on 177 held-out front cards**;
  backs 0/32 (separate data problem).
- Face-match calibration engine locked at FMR = 1e-5, 9/9 bounded tests green; two plans of
  record written (`plan-face-match.md`, `plan-arabic-text-fields.md`).

### The Codex sessions (v5/v6 mission + Stage-16/17 self-loop)
- Ran as a detached worker+enforcer pair; missions, logs, and handoffs are all in the repo
  root: `CODEX-WORKER-MISSION-v5-v6.md`, `CODEX-WORKER-LOG.md`, `CODEX-ENFORCER-LOG.md`,
  `STAGE17-SESSION-HANDOFF-20260701/02*.md`, `STAGE17-AUTONOMOUS-LEARNINGS-20260701.md`.
- Ran the Stage-3 SFT variants (`sft_fullcard_stage3_*`) and then an autonomous Stage-17
  self-improvement loop over selector/reranker branches.
- **Where Codex stopped (Jul-03):** final branch (pairwise confidence reranker) measured and
  declared **not promotable** (27.88% canonical vs Stage-6 25.0%; train-CV shows non-abstain
  thresholds are break-prone). Logged as a concrete blocker for the whole residual char/lex
  selector family. Result docs: `STAGE17-*-RESULT-2026070{2,3}.md`.

### v5 Stage 1+2 (Jun-30) — honest baseline established
- Direct family-chain ROI read + leakage-safe gazetteer (TRAIN-only).
- **3-pass vision-consensus gold** with independent adjudication → `claude_gold_v2.json`
  (219/220 usable). EVAL-ONLY — never a training teacher.
- Best deployable 2B baseline vs that gold, exact match: **firstName 70.8 / lastName 51.1 /
  address 64.1**. 97% target missed on every field → retrain required.

### Campaign V6-BEST (Jul-15) — the latest stop point
- Confidence-gated escalation architecture built + validated end-to-end:
  - **FS-oracle** (gate + perfect reader) = **99.1 / 93.2 / 90.9** → CLEARS the 95/90/90
    target; the gate correctly selects which crops to escalate.
  - **FS-real** = **79.5 / 76.7 / 73.2** — capped by the honest single-pass reader ceiling
    (~78/76/71 vs the consensus gold; multi-pass would be circular).
- v6 retrain (Naskh-font synthetic + direct-family task) lifted standalone lastName +5.0 and
  HALVED lastName escalation (63%→38%). Best-of standalone 2B = 72.6/68.9/69.1.
- **Verdict: targets not met, no deploy.** Diagnosis: residual errors are crop-resolution
  glyph ambiguity, not data volume.

## 3. Open levers (all operator-gated — talk to Kareem before pulling)

1. **Higher crop resolution in the production pipeline** — the identified next lever;
   needs sign-off because it touches the prod capture path.
2. **72B escalation reader** — blocked: VPS-2 (31.13.237.164) is currently unreachable.
3. Real-citizen data collection — hard operator/team gate (consented captures only; never
   scrape; Egypt Law 151/2020 + ISO 30107-3 / NIST 800-63A framing in the plan).

## 4. Where the data lives (all under the project root; `sudo` to read)

| What | Path (relative to `/home/wael/projects/KYC-By-Mercatura`) |
|---|---|
| Consented front-card digit dataset (1,603 train imgs) | `benchmark/datasets/arabic-numbers-v2-roboflow/` |
| Fraud/authenticity bootstrap dataset | `benchmark/datasets/sidtd/` |
| Dataset registry/loaders (+ license ledger) | `benchmark/datasets/registry.py`, `for-team/DATASETS-LICENSE-LEDGER.md` |
| 32 real labeled back cards | `benchmark/egypt_backs_v1/` |
| Face-match work | `benchmark/face_match/` |
| Forgery / front-proof batteries | `benchmark/forgery/`, `benchmark/front_proof/` |
| TRAIN gold (1,257 cards) | `train_gold.json` |
| TEST gold — 3-pass consensus, EVAL-ONLY | `claude_gold_v2.json` (+ `gold_v2_parts/`) |
| Confidence-calibration slices | `conf_train.json` (700 TRAIN), `conf_test.json` (220 TEST) |
| Trained weights (T1 digits etc.) | `ocr-service/training/runs/` (e.g. `t1_digits_real_v1/weights/best.pt`) |
| Stage-3 SFT variants (Codex) | `sft_fullcard_stage3_*` |
| v6 synthetic renderer (Naskh) | `render_synth_v6.py` |
| Scorers (use these, not ad-hoc) | `score_vs_gold_stage1.py` (+ `_v4`, `_stage3`) |

Raw Codex transcripts (outside the repo): `/root/.codex/sessions/2026/…` (root access).
Memory checkpoints: `for-team/session-checkpoint-*.md` (Jun-27 wave) and Wael's index at
`/home/wael/.claude/projects/-home-wael-projects-KYC-By-Mercatura/memory/MEMORY.md`
(`kyc-v5-stage12-baseline`, `v6-campaign-phase0-1`). Master narrative: `FINAL-REPORT.md`
(§0 Codex numbers, §0a independent re-measurement — kept deliberately separate), full traces
in `WORKER-LOG.md` / `ENFORCER-LOG.md`.

## 5. Hard-won environment gotchas (read before running anything)

- **transformers 5.3.0 loss-inflation bug is still present**: always train with
  `grad_accum=1, label_smoothing=0` (verified recipe; `smoke_train_tf53.py` reproduces it).
- **`claude_gold_v2.json` is evaluation/adjudication gold ONLY** — never a 2B training
  teacher (circularity).
- Qwen2-VL confidence sampling: pass `top_k=0` or generation collapses to greedy
  (self-consistency signal dies silently).
- GPU0 carries protected tenants (~42.5 GB vLLM/LTX) — check free VRAM before any training;
  prior runs kept a guard refusing to start under 7 GB free.
- Report metrics as STRICT + CONTENT-FAIR side by side (the compound-name convention
  عبد X == عبدX masked +13–16 pts on lastName historically).
- Zero test leakage discipline: gazetteers and calibration are TRAIN-only; check
  `for-team/silent-error-fix-and-merge-gate.md` before merging anything.
