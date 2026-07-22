# KYC By Mercatura — Security & Compliance Launch Gate

Status legend: ✅ done in-code · 🔲 external/manual action required before go-live

This document is the pre-launch checklist and the scope handed to a third-party
pen tester and legal reviewer. The application-layer controls are built; the
remaining items are validation and operations that code cannot self-certify.

---

## 1. Architecture summary (for the pen tester)

| Component | Tech | Exposure |
|---|---|---|
| Frontend | React + Vite, served from ICP asset canister | Public |
| KYC canister (`rust_backend`) | Rust on ICP | Public Candid methods, admin-gated writes |
| SMS canister (`sms_verification_backend`) | Rust on ICP | Public `send_sms` / `verify_otp` |
| OCR service | Flask + EasyOCR + DeepFace | VPS, HTTPS :5000, called by browser + canister outcalls |

**Trust boundaries:** browser ↔ canister (Candid over HTTPS), browser ↔ OCR
service (HTTPS), canister ↔ OCR service (IC HTTP outcall). Admin auth is via
Internet Identity; admin status is re-checked against the canister every 5 min.

**Sensitive data:** national ID, name, phone, address, DOB on-chain (KYC
submissions). Face images are **never** stored on-chain — only a `faceVerified`
boolean. OTP codes live in stable memory with a 5-minute TTL.

---

## 2. Application-layer controls already implemented ✅

### Authentication & authorization
- ✅ Admin-only methods gated by `is_admin()` / `require_admin()` (controller or `set_admin`'d principal)
- ✅ Admin re-validation every 5 min on the client; revoked principals lose UI access
- ✅ Data deletion requires national ID **and** matching phone (second factor)

### Input validation (defense in depth — client, canister, OCR service)
- ✅ Egyptian NID: 14 digits, prefix 2 or 3 (canister + client)
- ✅ Email: single `@`, non-empty local part, dotted domain, ≤254 chars (submit + `configure_email`)
- ✅ Phone normalized server-side; required before submit
- ✅ `submission_id` ≤128 chars; `from_email` validated; birth-date format + range
- ✅ Governorate/gender are dropdowns; "Unknown" rejected at review
- ✅ Frontend `maxLength` on all free-text fields matching canister caps

### Rate limiting & abuse
- ✅ OTP: 3/phone/hour, 200 global/hour (SMS canister)
- ✅ Session creation: 10/hour/principal
- ✅ KYC submit: 3/hour/principal
- ✅ OCR service: 60/hour global, `/verify-face` 10/min, `/health` 20/min

### Liveness & biometric integrity
- ✅ Passive liveness (Laplacian variance) rejects flat photos/screens
- ✅ **Active liveness**: head-turn challenge; rejects no-motion (replay) and identity-change (face swap)
- ✅ Face match via ArcFace cosine similarity, threshold 75% (clamped 30–99)
- ✅ Multiple-face and dark/overexposed-selfie rejection

### Data protection & privacy
- ✅ Face images excluded from chain (GDPR data minimisation)
- ✅ National IDs scrubbed from OCR logs (digit counts only)
- ✅ OTP comparison is constant-time (no timing side-channel)
- ✅ Biometric consent logged on-chain before camera opens
- ✅ Self-service deletion (`delete_my_kyc`) + confirmation modal

### Hardening
- ✅ CSP + `X-Content-Type-Options` + `X-Frame-Options: DENY` + `Referrer-Policy` on canister HTTP responses
- ✅ SSRF guard on `configure_ocr_server` (rejects private/loopback ranges)
- ✅ OCR outcall response capped at 2 MB; audit export capped at 10k/call
- ✅ Session state machine prevents completed-session rollback / replay
- ✅ Admin bulk reads + exports + deletions written to the audit log

### Testing
- ✅ 16 Rust unit tests (validation, payload parsing) — green
- ✅ Playwright E2E covering the 3 critical flows (desktop KYC, mobile handoff, admin review)

---

## 3. Pre-launch gate — external/manual ⬜

### Operations
- 🔲 Provision TLS on the VPS (`ocr-service/setup-tls.sh`) — **hard blocker** (camera needs HTTPS)
- 🔲 Install systemd unit + uptime monitor (`ocr-service/deploy/`)
- 🔲 Configure alert webhook in `monitor.sh`
- 🔲 Re-set Twilio credentials after any deploy that resets stable memory
- 🔲 Schedule daily `scripts/backup-kyc.sh --network ic` on an encrypted volume
- 🔲 Verify canister `pre_upgrade`/`post_upgrade` preserves stable memory (do a dry-run upgrade on a staging canister)
- 🔲 Set production `ALLOWED_ORIGINS` (no localhost) and `FACE_THRESHOLD`

### Validation
- 🔲 Run one full KYC + one QR handoff on a real phone over production HTTPS
- 🔲 `certbot renew --dry-run` succeeds; confirm renewal restarts the service
- 🔲 Confirm `systemctl stop kyc-ocr` triggers monitor restart + alert within 4 min

### Third-party pen test — requested scope
1. **Auth bypass**: can a non-admin principal call admin methods? Can II session be replayed/forged?
2. **Rate-limit evasion**: principal cycling, OTP brute force, session-creation spam
3. **Liveness spoofing**: printed photo, phone-screen replay, deepfake video, photo + real head behind it
4. **Injection**: Candid payload fuzzing into `submit_kyc` / `complete_verification`; OCR endpoint payloads
5. **SSRF**: attempt to redirect OCR outcalls to internal infrastructure
6. **PII exposure**: data in logs, error messages, client bundle, browser storage, network traces
7. **Transport**: TLS config grade (target A on SSL Labs), cipher suites, HSTS
8. **Session/CSRF**: mobile-handoff session hijack, completed-session manipulation

### Legal / compliance review — requested scope
1. **Egypt PDPL (Law 151/2020)**: lawful basis, consent records, data-subject rights, breach notification, any cross-border transfer (the OCR VPS location matters)
2. **GDPR** (if any EU data subjects): Art. 9 explicit consent for biometrics, DPIA for biometric processing, retention schedule, right to erasure (covered by `delete_my_kyc`)
3. **Retention policy**: define and enforce how long KYC records are kept; OCR result stores already auto-prune at 1000 / have `cleanup_ocr_results`
4. **Consent text**: review the biometric-consent and privacy-policy wording against the above
5. **Sub-processors**: Twilio (SMS), Resend (email), VPS host — disclose in privacy policy

---

## 4. Known residual risks (accept or mitigate before launch)

| Risk | Severity | Mitigation status |
|---|---|---|
| Liveness can't stop a high-effort deepfake video that follows the prompt | Medium | Active challenge raises the bar; consider a vendor passive-liveness model for high-value onboarding |
| OCR service is a single VPS (no HA) | Medium | systemd auto-restart + monitor alerting; add a second instance + LB if uptime SLA demands |
| Local stable memory lost on bad upgrade | High | Daily off-chain backup (`backup-kyc.sh`); verify upgrade hooks on staging first |
| Admin read methods are `#[update]` (slower) to enable audit logging | Low | Accepted trade-off for traceability |
