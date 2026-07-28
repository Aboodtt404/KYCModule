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

### 3. Rec fine-tune (`/home/abdelrahman/kyc-finetune`) — trained, REVERTED on real captures
Corpus: 2223 train + 396 val tight line crops from TRAIN gold (TEST never touched).
Two hard-won rules (memory: `kyc-rec-finetune`): tighten band crops with PP det before
training, and store Arabic labels in VISUAL order (`label[::-1]`) because paddlex
un-reverses arabic rec output.

Run v3 (best val 82.8% @epoch37; frozen TEST CF): firstName **83.6** (stock 81.3),
lastName **76.7** (74.0), address 58.6 (61.4 — corpus had no address lines). Serving
eval on the dataset cards improved to 63.5/59.4/52.3 — **but Abdelrahman's live phone
test produced garbage names**, so the fine-tune was removed from serving entirely
(weights remain at `/home/abdelrahman/kyc-finetune/output/v3`; serving is exactly the
pre-SFT stock reader). Lesson: the TRAIN corpus is low-res dataset
crops; the fine-tune overfits that domain and loses on clean high-res captures the
dataset never covered. **Do not re-enable without a real-capture eval set** — the
server now saves the last 40 uploads to `ocr-service/debug_captures/` (gitignored,
`DEBUG_CAPTURE_DIR=off` to disable) and logs every PP field read, exactly so that
eval set can be accumulated from live tests.

Same live test exposed a digit-path failure (unrelated to the fine-tune): YOLO digits
returned 15 detections → invalid → EasyOCR multipass hallucinated an NID → wrong
birthdate. Fixed: over-length digit reads (15-16) are recovered by dropping digits and
accepting a UNIQUE mod-11-checksum-valid candidate (`_recover_nid`), and `_national_id`
now scans all 14-digit windows preferring checksum-valid ones.

## Decisions / discipline that must survive
- TEST (claude_gold_v2 + crop_cache) is eval-only, read frozen, never shipped to a
  training box. All tuning on TRAIN/TRAIN-val (seed 42).
- GPU0 is shared with a vLLM tenant that grows unpredictably — check free VRAM before
  training (batch 32 fits in ~6GB), never touch the tenant.
- No mainnet deploys without Kareem. SMS needs `configure_twilio` before removing the
  skip-phone button.
- Present to Kareem: PP results reset the research baseline (stock CPU-capable model
  beat the fine-tuned 2B on names → the brief's operator-gated levers look different).

## Office test round 1 (2026-07-28, Kareem's team; Wael + one more)
Front scan praised. Three failures, all fixed the same day from the saved captures:
- **Back scan extracted nothing** (the research's 0/32 problem, reproduced live).
  Root causes: back pipeline never card-cropped (card fills ~⅓ of a live photo, the
  field detector found almost no boxes on the full scene), the back NID is printed in
  ARABIC-INDIC numerals (digit YOLO knows Western glyphs only; nid_back box found on
  0/2 real captures), and every field read used EasyOCR. Now: `_yolo_card` crop →
  PP-reads with raw postprocess (no gazetteer on occupation/dates) → NID from a PP
  read of the card's TOP band, accepted only if a 14-digit window passes the mod-11
  checksum (else honest empty → verifier abstains). Wael's back now yields
  checksum-valid NID + occupation + dates, enabling the front==back verdict signal.
- **Nobody could pass face matching**: sigmoid was centred at cosine 0.6 with default
  threshold 75 ⇒ effectively demanded dist ≤ 0.49, stricter than ArcFace's published
  same-person boundary (0.68) on the hardest domain (printed ID photo vs selfie);
  genuine Wael peaked at dist 0.661. Now: sigmoid centred at 0.68 (sim 50 ==
  borderline same person), default `FACE_THRESHOLD` 50, and the ID is matched against
  the BEST of selfie+challenge frames (identity-consistency across frames is already
  enforced, so an impostor gains nothing).
- **Liveness prompts flashed too fast to read**: 900ms per instruction → 2.4s.

## Office test round 2 — "random words on other people's IDs" (2026-07-28)
Stage-traced all 9 saved front captures (tracer: scratchpad trace_front.py pattern —
dump card box → field boxes → digit read → band overlay → PP reads per capture and
LOOK at them). Two root causes, both fixed and verified by replaying every capture:
- **Band crops mis-anchor by a full text line on real phone captures** (firstName
  band sat on the printed card header — that's the "random words"). The field
  detector boxes were near-perfect on the same captures. Priority flipped: highest-
  conf box read (3%/10% padding) wins per field; bands only fill empty/low-conf
  (<0.5) fields; any read matching the header regex (جمهوري/بطاقة/تحقيق/الشخصية) is
  discarded. Bands stay as the rescue path for the low-res dataset domain.
- **A failed NID discarded the whole YOLO extraction** and fell to multipass EasyOCR
  full-card scan (the actual garbage source). Now: PP reads the nid crop as a
  checksum-gated fallback (recovered 3/5), and if no valid NID remains the good
  field reads are RETURNED with empty NID (verifier REJECTs → retake prompt).
Replay of all 9: 9/9 correct names+addresses (was 4/9), 6/9 checksum-valid NIDs,
0 random-word extractions. Remaining misreads are rec-level (سمر/عمر-class, smudge
chars) and always flagged ABSTAIN, never silently accepted.

Capture quality: `grabSharpestBlob` (hawiya camera.js) samples 5 frames over ~1s and
keeps the sharpest (motion blur was the top failure); server blur gate on the card
crop (`CAPTURE_MIN_SHARPNESS`, default 15 — catastrophic office capture scored 13.8,
every usable one ≥17) returns "hold steady" → frontend routes back to the camera.
Debug-capture replays: send `X-Debug-Replay: 1` to avoid re-saving.

## Det-first research (2026-07-28, `kyc-bakeoff/detfirst.py`)
Question: can PP det+rec line boxes + geometry/content rules replace the YOLO field
detector? Rules: NID row self-identifies (most digits, lower half, checksum-window),
header by keyword OR geometry (centered/wide/top — rec garbles the text on low-res),
then right-column Arabic lines top→bottom = firstName / lastName / address; serial =
Latin line below NID. Results (content-fair):
- REAL office captures: **5/5 perfect** — incl. fixing a box-crop misread (عمر not سمر)
  and reading NIDs through blur that defeats the digit YOLO. Serial for free.
- TRAIN-val 200: **80.6/73.7/67.3** — at the ideal-crop reader ceiling.
- Frozen TEST 220 (one read): 65.3/58.9/50.9 vs bands' 67.6/68.0/58.2 — the gap is PP
  det MISSING the tiny firstName word on low-res cards → all lines shift up one
  (predicted fn == gold family name in most misses). Fixable on TRAIN only:
  shift-guard (firstName is 1-2 tokens / y-position vs NID anchor) + 2× upscale.
- **NID: 212/220 (96%) checksum-valid on TEST, 197/200 TRAIN, 5/5 real** — far beyond
  the digit-YOLO path, and it reads Arabic-Indic NIDs natively.
WIRED INTO SERVING same day (`detfirst_rules.py`, sidecar `/scan`): scan NID is the
checksum-gated fallback (and replaces a checksum-failing digit-YOLO read); scan
fields replace the band crops; field-box reads stay primary at conf ≥ 0.5. All NID
acceptance points additionally require date+governorate plausibility (`_nid_plausible`
— checksum alone false-accepted a window starting inside a fused issue date, live
office bug). Iterations on TRAIN-val 200 (CF): rules-only 80.6/73.7/67.3 →
+shift-guard/upscale/fn-rescue 88.8/79.3/70.9 → +TEMPLATE ZONES **90.3/79.3/70.9**.
Template zones (Abdelrahman's direction — the layout is fixed): field positions as
fractions of the header-bottom→NID-top anchor span, calibrated on 24 real captures
(fn 0.17, ln 0.33, addr 0.55/0.72, ±few %); any det-missed field is zone-cropped and
read directly (narrow right-strip retry for firstName). Visual overlays incl. the
computed zones: `ocr-service/debug_captures/detfirst_viz/` (regen via scratchpad
viz_detfirst.py). The research prototype `kyc-bakeoff/detfirst.py` now IMPORTS the
serving rules module — single source of truth.

## Backlog
Office retest (face + back + box-priority + blur gate) → det-first serving
integration (above) → card/field detector retraining (serving gap) → address
line-assembly conventions → date formatting on back reads → confidence-gate +
escalation architecture (validated in research, never serving-wired) → stable
domain / staging deploy.
