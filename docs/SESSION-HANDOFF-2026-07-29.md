# Session handoff — 2026-07-29 (day 2)

Continues `SESSION-HANDOFF-2026-07-28.md` (pipeline numbers, det-first/zones, office
round 1-2). Everything committed on `latest`. Stack bring-up: `./scripts/dev-up.sh`
(now writes `VITE_II_URL` to BOTH frontends' `.env.local`).

## Capture pipeline (server)
- **Rectification** (`ocr-service/rectify.py`): landmark homography — photo/front_logo/
  nid/serial/dob box centers → canonical 1712×1080 card. Edge/contour quads FAIL on
  real captures (1/9); content landmarks work (6/9, rest fall back to crop+deskew).
  Canonical landmark constants measured from 24 real office captures.
- **Blur gate is OFF by default** (`CAPTURE_MIN_SHARPNESS=0`). Two calibrations both
  false-rejected real phone frames (sharp captures score 8-12 in either measurement
  domain). Client sharpest-of-5 + checksum/verdict abstains are the honest quality
  gates. Re-enable only after calibrating on the debug_captures corpus.
- Session-step mirror: phone POSTs its flow step to OCR server `/session-step`
  (in-memory, TTL 1h, labels only); desktop polls it for the live "On phone: …" line.

## Frontend (hawiya)
- Auto-capture (3 steady detector ticks → shutter + lock-on ring), torch button,
  head-guide selfie choreography, scan-reveal over the user's own card during OCR,
  count-up scores, stamp/flip/typed-ref payoffs, Motion step transitions.
  **Camera trap**: AnimatePresence mounts screens ~220ms after step change — camera
  effect RETRIES until the <video> exists (7e7453d); never open on step change alone.
- BackReview screen (extracted back fields + front↔back match badge), human bilingual
  error mapping (`lib/errors.js` — raw engine text never headlines; NOTE `go()` clears
  error state, always setError AFTER navigating), face-retry coaching with real score,
  editable review (edits flagged `user_edited` in payload), wait-time hints.
- Brand: `Logo` component in `components/ui.jsx` with SVG paths copied VERBATIM from
  the design source (`Hawiya KYC Prototype.dc.html` in the handoff zip) — brackets +
  هـ glyph; light (ink/orange) and dark (gold/cream) variants. Wordmark = plain type
  in light contexts per design. Assets in `frontend-hawiya/public/brand/`.

## Identity / canister
- **Root-key trap #3**: authenticated actors built via `agentOptions` never fetch the
  root key → all queries fail cert verification → "not an admin" despite being on the
  list. Fixed with `authedKycActor()` (awaits fetchRootKey) used by auth context.
- **Admin claim code**: local II mints new principals across logins/origins, so the
  admin list goes stale. `set_admin_code` (controller) + `claim_admin(code)` (any
  signed-in caller) + `whoami` query. UI: the "Not an admin" screen has a code field.
  Current dev code: `hawiya-dev-2026`. DISABLE/rotate before any mainnet deploy.
- **Sessions**: idle-expire 10 min without a heartbeat (phone beats every 5s),
  24h absolute cap, hourly `ic-cdk-timers` sweep (armed in init/post_upgrade)
  removes idle-dead AND completed >24h. `session_expired()` is the single rule.
- **Candid drift trap**: `rust_backend/rust_backend.did` is HAND-WRITTEN. Rust
  `(u64, Vec<..>)` returns are TWO wire values — declaring them as one record breaks
  decode ("type mismatch: nat64 vs record"). New methods must be added to the .did
  AND `dfx generate rust_backend` run. Admin submissions tab was hidden behind three
  stacked bugs: swapped (limit, offset) args, root-key trap, candid tuple drift.
- Admin store wiped 2026-07-29 for a clean testing round (5 subs + all sessions).

## Integrity stack (BUILT 2026-07-29 afternoon — all three ship log-only/neutral)
1. **PDF417 strip decode** (`barcode417.py`, bebf494) — the back strip IS PDF417
   (partially issuer-encrypted; NOT plain ICAO MRZ text — treat any plaintext NID
   in the payload as the prize). Wired into `/egyptian-id-back` as a `barcode`
   block; plausible barcode NID fills a failed printed-band read; disagreement
   routes to the mismatch screen. KEY FACT: at 1080p the strip is ~2px/module —
   undecodable (0/10 saved captures) — so the client now opens ID cameras at 4K
   and uses ImageCapture.takePhoto (EXIF-normalized client-side, longest edge
   capped 3200px). Needs an office recapture to confirm the first live decode.
2. **FFT screen/print detector** (`pad_fft.py`, 1b297b8) — native-res tile
   spectra (NEVER whole-card resize — it low-passes the evidence), JPEG 8x8
   harmonics masked as spots at multiples of 64 (whole-axis masking swallows
   45° halftones — their cos·cos grid factors into axis cosines). 0/35 genuine
   flagged, 70/70 synthetic attacks caught. `pad` block in both ID endpoints,
   LOG-ONLY until the office feeds real photocopies + screen replays through.
3. **Tilt-under-torch challenge** (`holo.py` + HoloCheck screen, e610517) —
   after back-review; torch highlight sweeping the card = card-like, no
   highlight = flat (paper), big static blob = screen-like. Auto-skips no-torch
   phones, never blocks; hint rides in the payload as `document_liveness`.

Office retest must produce: (a) hi-res back captures (does the strip decode
live?), (b) a PAD corpus — same cards as photocopies and off-screen replays,
(c) tilt bursts on real cards (calibrate holo thresholds, esp. hue_shift).

## Standing discipline
No mainnet without Kareem. TEST set stays frozen. GPU0 tenant untouchable (check
free VRAM ≥7GB before anything heavy). Office retest is the highest-value input;
every capture lands in `ocr-service/debug_captures/` (replays send X-Debug-Replay).
