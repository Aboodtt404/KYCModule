# Production Readiness Plan — KYC by Mercatura (detailed)

Status as of 2026-06-14. Every gap from the platform assessment, expanded with:
current state (grounded in the actual code), the exact change, files touched,
acceptance criteria, and risks.

Tags: **[CODE]** I implement here · **[OPS]** needs VPS/credential · **[EXT]** needs vendor/lawyer/firm.
Effort: S = hours · M = 1–2 days · L = a week+ · XL = multi-week/external.

---

## Phase 0 — Cleanup

### 0.1 Remove stale built assets from source — [CODE] S
- **Now:** `frontend/src/assets/index-DAmfYJN-.js` (1.3 MB) and `index-CO9a5jlP.css` (105 KB),
  dated Jun 3, are committed build output sitting inside `src/`. They're dead — Vite
  emits to `dist/` — but they bloat the repo and confuse grep/search.
- **Change:** delete both; confirm nothing imports them (they aren't referenced).
- **Acceptance:** files gone, `vite build` + all tests still green.
- **Risk:** none.

### 0.2 Route stray console calls through the logger — [CODE] S
- **Now:** `ImageProcessor.jsx` and `OCRProcessor.jsx` (admin tooling pages) still call
  `console.*` directly. The rest of the 18 hits are auto-generated `declarations/` or the
  intentional `lib/logger.js`.
- **Change:** replace direct calls with `logger.*` so prod log level is respected.
- **Acceptance:** `grep console. src` returns only declarations + logger.
- **Risk:** none.

### 0.3 Guard against build output re-entering src — [CODE] S
- **Change:** add `frontend/src/assets/index-*.{js,css}` to `.gitignore`.
- **Acceptance:** a stray build can't be committed into `src/` again.

**Phase 0 total: ~1 hour.**

---

## Phase 1 — Launch-blocking operations

### 1.1 TLS on OCR + frontend origin — [OPS] M
- **Now:** `TLS_SETUP.md` + `setup-tls.sh` exist; cert not provisioned (per notes).
- **Why blocking:** browser `getUserMedia` (camera) requires a secure origin. Without TLS
  the document-capture and selfie steps silently fail on real phones.
- **Action (you):** run certbot per the runbook on the OCR host + serve frontend over HTTPS.
- **Acceptance:** camera opens on a physical phone over the public URL; no mixed-content warnings.

### 1.2 Containerize the OCR service — [CODE] M
- **Now:** run via `start.sh` — a single `python3 server.py` in a bash restart loop.
  `deploy/kyc-ocr.service` (systemd) + `deploy/monitor.sh` already exist.
- **Change:** add `ocr-service/Dockerfile` (Python 3.11 slim, system deps for OpenCV,
  pinned `requirements.txt`, pre-bake the YOLO `.pt` + EasyOCR weights into the image so
  the first request isn't a 30 s cold start) and a `docker-compose.yml` (ocr + redis).
- **Files:** new `ocr-service/Dockerfile`, `ocr-service/docker-compose.yml`, `.dockerignore`.
- **Acceptance:** `docker compose up` serves `/health` 200 with models warm.
- **Risk:** image size (DeepFace + torch + YOLO is heavy, ~3–4 GB). Mitigate with CPU-only
  torch wheels and multi-stage build.

### 1.3 Multiple auto-restarting workers — [CODE+OPS] M
- **Now:** one Flask process; one crash = onboarding down until the bash loop restarts it.
- **Change:** front with gunicorn (`--workers N --timeout 120 --preload`), so a hung request
  on one worker doesn't take the service down, and model load is shared via `--preload`.
  Add `ocr-service/gunicorn.conf.py`.
- **Caveat:** EasyOCR/DeepFace are memory-heavy — each worker loads its own models unless
  preloaded. Size workers to host RAM (likely 2–3 on a typical VPS).
- **Acceptance:** killing one worker doesn't drop `/health`; concurrent requests don't serialize.

### 1.4 Redis-backed rate limiting + warm models — [CODE+OPS] M
- **Now:** Flask-Limiter uses in-memory storage → limits reset on every restart, and aren't
  shared across workers (so the real limit is N× looser than configured).
- **Change:** point Flask-Limiter at Redis (`REDIS_URL` already read by `server.py`); document
  the env var in compose.
- **Acceptance:** rate limit holds across a worker restart and is shared across workers.

### 1.5 Monitoring webhook + uptime alert — [OPS] S
- **Now:** `deploy/monitor.sh` exists but needs a webhook URL.
- **Action (you):** set the Slack/PagerDuty webhook; add an external uptime check (e.g.
  UptimeRobot) hitting `/health`.
- **Acceptance:** killing the service produces an alert within the check interval.

### 1.6 Credential re-set runbook — [OPS] S
- **Now:** fresh canister deploys reset stable memory → Twilio (SMS) + Resend (email) creds
  must be re-applied via `configure_*` admin calls. Easy to forget.
- **Change:** a short `POST_DEPLOY.md` checklist + a `dfx` script that re-applies all config
  (admin principals, OCR URL, frontend URL, email, Twilio) in one shot.
- **Acceptance:** one command restores a fresh deploy to working config.

### 1.7 Scheduled off-chain backup — [CODE+OPS] M
- **Now:** `export_audit_log_range` exists; KYC submissions have **no** automated snapshot.
  Stable structures survive normal upgrades, but a bad migration or fat-fingered delete is
  unrecoverable.
- **Change:** a backup script that pages `get_kyc_submissions_page(limit, offset)` +
  `export_audit_log_range`, writes a timestamped encrypted JSON bundle to off-host storage,
  runnable from cron. (CODE: the script; OPS: the storage target + cron + encryption key.)
- **Files:** new `scripts/backup-kyc.sh` (or `.mjs` using dfx/agent).
- **Acceptance:** a cron run produces a restorable, encrypted snapshot; documented restore steps.
- **Risk:** the backup contains PII — must be encrypted at rest and access-controlled.

**Outcome:** real traffic without a single-point-of-failure or silent data-loss risk.
True multi-host HA (1.x stretch) is deferred to Phase 3 unless volume demands it.

---

## Phase 2 — Trust & integrity (the verification gets real teeth)

### 2.1 MRZ check-digit validation — [CODE] M  ★ highest value/effort ratio
- **Now:** `passport_ocr.py::_parse_td3` reads the TD3 MRZ and extracts fields, but the
  **check digits are skipped** — positions 9 (doc number), 19 (DOB), 20 (sex... actually
  expiry), 27 (expiry), 43 (composite). The MRZ's whole purpose is to be self-verifying;
  we're throwing that away.
- **Change:** implement the ICAO 7-3-1 weighted checksum; validate each field's check digit
  and the composite. Return a `mrz_valid: bool` + per-field flags in the OCR response. The
  frontend/admin surfaces "MRZ checksum failed → manual review."
- **Files:** `ocr-service/passport_ocr.py` (+ unit tests for known-good/known-bad MRZ strings).
- **Acceptance:** a tampered DOB/doc-number fails the checksum; a valid passport passes.
- **Why it matters:** catches a large class of forged or mis-OCR'd passports for ~a day's work,
  no new dependencies.

### 2.2 Stronger Egyptian NID structural validation — [CODE] S
- **Now:** `validate_national_id` checks only: length 14, all digits, starts with 2 or 3.
- **Change:** decode the embedded structure — digit 1 = century, digits 2–7 = YYMMDD (must be
  a real date), digits 8–9 = governorate code (must be in the valid set), digit 13 parity =
  gender. Reject impossible dates / unknown governorate codes.
- **Files:** `rust_backend/src/lib.rs` (+ unit tests; we already have NID test scaffolding).
- **Acceptance:** `29913310...` (month 13) and bad governorate codes are rejected.
- **Risk:** must not reject valid edge cases — validate the governorate code list against an
  authoritative source before enforcing.

### 2.3 Cross-field consistency checks — [CODE] M
- **Now:** the NID *encodes* DOB + gender, and OCR *also* reads DOB + gender off the card face,
  but they're never compared. A mismatch is a strong tamper/error signal.
- **Change:** in `submit_kyc` (or pre-submit), compare NID-derived DOB/gender against the
  OCR'd values; on mismatch, store the submission flagged `consistency_warning` for admin review
  rather than auto-accepting.
- **Files:** `rust_backend/src/lib.rs`; surface the flag in `KYCSubmissions.jsx`.
- **Acceptance:** a submission where card-DOB ≠ NID-DOB lands in review with a visible warning.

### 2.4 Admin role tiers — [CODE] M
- **Now:** `ADMIN_MAP` is `principal → "1"`; every admin can approve, reject, delete, export
  PII, and manage API clients. No segregation of duties.
- **Change:** store a role in the map value (`"super_admin"` | `"reviewer"`). `reviewer` can
  approve/reject; `super_admin` adds delete / export / API-client management / `set_admin`.
  Add `require_super_admin()`; gate the relevant endpoints; reflect role in `is_admin_check`
  so the frontend hides actions a reviewer can't take.
- **Files:** `rust_backend/src/lib.rs` (admin helpers + endpoint guards), DID, JS declarations,
  `AdminDashboard.jsx`/`KYCSubmissions.jsx`/`ApiClients.jsx` (conditional rendering).
- **Migration:** existing entries with value `"1"` default to `super_admin` (backward compatible).
- **Acceptance:** a `reviewer` principal can't delete a submission via API or UI.

### 2.5 Maker-checker on destructive actions — [CODE] M (optional, strong control)
- **Change:** deleting a submission or API client requires a second `super_admin` to confirm a
  pending request (two-key). Adds a small `PENDING_DESTRUCTIVE` map + approve endpoint.
- **Acceptance:** a single admin cannot unilaterally delete; the audit log shows both actors.
- **Note:** only worth it if your governance model needs it — adds friction.

### 2.6 Email fallback provider — [CODE] S
- **Now:** single provider (Resend), single from-address; we surface "email failed" to admin.
- **Change:** add a secondary provider path (e.g., SMTP) tried on Resend failure.
- **Files:** `rust_backend/src/lib.rs` `send_status_email`; config via existing `configure_email`.
- **Acceptance:** with Resend disabled, approval emails still send via fallback.

### 2.7 Server-side image-quality gate — [CODE] S
- **Now:** quality (blur/glare) is checked client-side; a crafted request can bypass it.
- **Change:** re-run the Laplacian/brightness gate server-side in the OCR endpoints; reject
  unusable scans with a clear error before wasting an OCR pass.
- **Acceptance:** a blurry image POSTed directly to `/egyptian-id` is rejected server-side.

**Outcome:** document authenticity (MRZ + NID structure + consistency) and proper admin access control.

---

## Phase 3 — Regulatory, certification & scale (external)

### 3.1 Certified liveness / PAD — [EXT] XL
- Our active head-turn challenge defeats casual photo/replay, but it is **not certified**
  (ISO 30107-3 / iBeta L1–L2). Regulated KYC usually requires certified presentation-attack
  detection. Options: integrate a vendor (iProov, FaceTec, Onfido) behind the existing
  `/verify-face` seam, or pursue certification of the in-house check (slow, costly).
- **Decision needed:** vendor vs. self-certify — drives cost and timeline.

### 3.2 DPIA + PDPL/GDPR legal review — [EXT] XL
- Built: consent logging on-chain, self-service deletion (`delete_my_kyc`), data minimization
  (no biometrics on-chain). Missing: a Data Protection Impact Assessment and legal sign-off
  against Egypt's PDPL (and GDPR if EU users). Lawyer-led; start early (long lead time).

### 3.3 Third-party penetration test — [EXT] L
- Independent test of the canister API, OCR service, and frontend. The security work is done;
  this validates it. Budget + schedule a firm.

### 3.4 Sanctions / PEP screening — [EXT+CODE] L
- If your use case is AML-regulated, you likely need name screening against sanctions/PEP
  lists via a data provider. CODE: integrate at submit/approve time; EXT: the data feed.

### 3.5 True OCR high availability — [OPS] L
- Multi-instance OCR behind a load balancer across regions. Only if Phase 1 hardening proves
  insufficient at observed volume.

---

## Sequencing

```
Week 1     Phase 0 (all)  +  CODE artifacts for 1.2 1.3 1.4 1.7  +  start 2.1 2.2
           In parallel (you/ops): 1.1 TLS, 1.5 monitoring, 1.6 creds
Week 2–3   Phase 2 CODE: finish 2.1, 2.3, 2.4, 2.6, 2.7
Ongoing    Phase 3 procurement (legal + liveness vendor) — kick off in Week 1, long lead times
```

### What I can start now, zero external dependencies
Phase 0 (all) · 2.1 MRZ checksums · 2.2 NID structure · 2.3 consistency · 2.4 admin roles ·
2.6 email fallback · 2.7 server-side quality gate · plus authoring the Phase 1 code artifacts
(Dockerfile, gunicorn config, backup script) for you to deploy.

### What only you/ops can do
1.1 TLS · 1.5 webhook · 1.6 credentials · deploying to the VPS · backup storage target + key.

### What needs budget/lead-time
All of Phase 3 — start vendor/legal conversations immediately.

---

## Recommended first slice (if you want one concrete sprint)
**"Trust hardening" — all CODE, ~3–4 days, no infra needed:**
0.1 + 0.2 (cleanup) → 2.1 (MRZ checksums) → 2.2 (NID structure) → 2.3 (consistency flag) →
2.4 (admin roles). This measurably raises fraud resistance and tightens access control without
touching the VPS, and every piece ships behind the existing tests + E2E suite.
```
