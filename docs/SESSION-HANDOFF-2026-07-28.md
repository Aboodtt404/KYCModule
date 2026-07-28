# Session handoff — 2026-07-28

State of the KYC project after the Jul 22–28 working sessions (Abdelrahman + agent).
Everything below is committed on branch `latest` (github Aboodtt404/KYCModule) unless
marked in-flight. Companion context: `docs/BACKEND-PIPELINE.md` (API contract),
`KYC-RESEARCH-BRIEF-2026-07-22.md` (research history, Wael's repo readable via sudo at
`/home/wael/projects/KYC-By-Mercatura`).

## What runs, and how to bring it up

`./scripts/dev-up.sh` — idempotent, restarts anything dead and re-mints tunnels:
replica + canisters (rust_backend, sms, II 2.0 backend `rdmx6` + II frontend), PP
sidecar (:5001, GPU) → OCR server (:5000), legacy frontend (:3000), **hawiya** frontend
(:3001), II host-rewrite proxy (:8943), three cloudflared quick tunnels. It rewrites
`frontend/.env.local` and re-points both II canisters at the new origins, then prints
the URLs. Tunnel URLs rotate on every restart — always use the printed ones.

## The three workstreams and where they stand

### 1. Hawiya frontend (`frontend-hawiya/`) — DONE, needs a real-device pass
Full implementation of the Claude-Design handoff (zip in repo root): mobile flow with
verdict branching (accept/abstain/reject from the checksum verifier), back-match,
active-liveness selfie (4 head-turn frames), OTP + **skip-phone** (records
`phone_verified:false`), review/submit, status timeline; desktop QR handoff with live
session polling; admin console (submissions approve/reject, sessions, audit, API
clients, gated on `is_admin_check`). Live capture overlay: static bilingual field
zones + `/detect-fields` polling (~0.35s) that snaps labels onto detected boxes and
locks the frame green.

Traps solved (memory: `kyc-agent-traps`): agent host must be `window.location.origin`
off-mainnet; await `agentReady` (root-key fetch) before a page's first canister call;
submission payload must match rust `KycSubmissionPayload` (`kycData.ocrData.*`,
required `submissionId/timestamp/phone/documentFile/faceVerified/status`;
`complete_verification` also wants top-level `ocrData.national_id`); `submit_kyc` is
rate-limited 3/hour/principal.

### 2. OCR serving (`ocr-service/`) — PP live, ~2× accuracy
PaddleOCR (PP-OCRv6_medium_det + arabic_PP-OCRv5_mobile_rec + TRAIN-frozen
punct/gazetteer post-process) serves the Arabic text fields via the **pp_service.py
sidecar** (:5001; paddle segfaults/deadlocks in-process next to TF+torch — never move
it back in). Text fields read from digit-row-anchored band crops (primary) with YOLO
field boxes and EasyOCR as fallbacks; card-detector miss → full frame. Face
verification uses retinaface (opencv-5 haar data is gone) and active liveness DECIDES
when challenge frames exist (Laplacian gate alone false-flagged real users).

Numbers (220 held-out TEST vs claude_gold_v2, content-fair, firstName/lastName/address):
EasyOCR serving 35.6/24.2/19.1 → **PP serving 62.6/56.6/52.3** (reader ceiling on
ideal crops 81.3/74.0/63.6). Eval harness: `/home/abdelrahman/kyc-bakeoff/serving_eval.py`
(throttle ≥2.2s/req — endpoint limit 30/min). The serving↔ceiling gap is
localization on low-res eval cards; real phone captures should land higher.

### 3. Rec fine-tune (`/home/abdelrahman/kyc-finetune`) — DONE, SHIPPED for names
Corpus: 2223 train + 396 val tight line crops from TRAIN gold (TEST never touched).
Two hard-won rules (memory: `kyc-rec-finetune`): tighten band crops with PP det before
training, and store Arabic labels in VISUAL order (`label[::-1]`) because paddlex
un-reverses arabic rec output.

Run v3 result (best val 82.8% @epoch37; frozen TEST, content-fair):
firstName **83.6** (stock 81.3), lastName **76.7** (74.0), address 58.6 (61.4 —
regressed; corpus had no address lines, and address bands are two-line crops with no
per-line gold, so adding them is a pseudo-labeling project, not a quick rerun).

**Shipped as per-field routing** in `ocr-service/pp_reader.py`: firstName/lastName →
fine-tuned rec (`ocr-service/models/arabic_rec_ft_v3`, override `PP_FT_REC_DIR`),
address → stock. Serving re-eval (220 TEST, 0 errors): 62.6/56.6/52.3 →
**63.5/59.4/52.3** CF. Bench artifacts: `kyc-bakeoff/results_pp_v6det_ft3_crops.json`,
scorer row `pp v6det ft3(crops)`. Raising address means fixing localization or the
line-split labeling problem — backlog, not a rec-weights problem.

## Decisions / discipline that must survive
- TEST (claude_gold_v2 + crop_cache) is eval-only, read frozen, never shipped to a
  training box. All tuning on TRAIN/TRAIN-val (seed 42).
- GPU0 is shared with a vLLM tenant that grows unpredictably — check free VRAM before
  training (batch 32 fits in ~6GB), never touch the tenant.
- No mainnet deploys without Kareem. SMS needs `configure_twilio` before removing the
  skip-phone button.
- Present to Kareem: PP results reset the research baseline (stock CPU-capable model
  beat the fine-tuned 2B on names → the brief's operator-gated levers look different).

## Backlog (post fine-tune)
Real-device test pass of hawiya → card/field detector retraining (serving gap) →
address line-assembly conventions → back-of-card accuracy (research's 0/32 problem) →
confidence-gate + escalation architecture (validated in research, never serving-wired)
→ stable domain / staging deploy.
