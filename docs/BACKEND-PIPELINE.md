# KYC Backend Pipeline — Frontend-Builder's Reference

Everything the product does happens in **three backends plus Internet Identity**. The
current React app is only glue around these; any new frontend talks to exactly the same
surfaces described here.

```
                         ┌──────────────────────────────┐
        HTTPS            │  OCR service (Flask, :5000)  │   stateless, holds no PII
  ┌──────────────────►   │  YOLO + OCR + DeepFace +     │   (images processed in tmp,
  │                      │  NID checksum verifier       │    securely deleted)
  │                      └──────────────────────────────┘
  │
Frontend (any)
  │                      ┌──────────────────────────────┐
  ├── @dfinity/agent ──► │  rust_backend canister (IC)  │   ALL state lives here:
  │    (II identity      │  KYC submissions, handoff    │   submissions, sessions,
  │     or anonymous)    │  sessions, OCR results,      │   audit log, API clients,
  │                      │  audit log, file store       │   uploaded documents
  │                      └──────────────────────────────┘
  │
  │                      ┌──────────────────────────────┐
  ├── @dfinity/agent ──► │  sms_verification canister   │   OTP via Twilio HTTPS
  │                      └──────────────────────────────┘   outcalls
  │
  └── popup/redirect ──► Internet Identity (login → delegation → principal)
```

---

## 1. OCR service (Flask, port 5000)

Stateless HTTP. Images go in, structured JSON comes out. Rate-limited per endpoint.
Request bodies: **raw image bytes** for the OCR endpoints (not multipart, not JSON),
**JSON with base64 strings** for face verification (plain base64, **no `data:image/...`
prefix**). Max 10 MB per image (20 MB for the verify-face request).

### GET /health
```json
{ "status": "healthy", "version": "...", "timestamp": 1785...,
  "services": { "egyptian_id": true, "passport": true, "yolo_pipeline": true,
                "yolo_segmentation": true, "deepface": true } }
```
Poll this before starting a capture flow; if `yolo_pipeline` is false the server fell
back to a much weaker OCR path.

### POST /egyptian-id  (alias: POST /ocr) — front of card
Body: raw JPEG/PNG bytes. ~10–20 s on CPU.
```json
{
  "success": true,
  "processing_time": 12.3,
  "method": "yolo/... | easyocr/<variant>",
  "extracted_data": {
    "first_name": "...", "second_name": "...", "full_name": "...",
    "national_id": "29901011234567",
    "address": "...", "birth_date": "1999-01-01", "governorate": "...",
    "gender": "male|female", "serial": "...",
    "face_image": "<base64 crop of the ID photo> | null",
    "verification": {                    // deterministic verdict — ALWAYS read this
      "verdict": "accept | abstain | reject",
      "score": 0.97,
      "...": "per-check details (checksum, structure, cross-field, front==back)"
    }
  },
  "face_verification": { "face_detected": true, "face_image": "<same base64>" }
}
```
Errors: `400` no/bad image, `413` too large, `500` server fault — all
`{"success": false, "error": "..."}`.

**The verdict is the product's core safety property.** `reject` = a deterministic
contradiction (bad NID check digit, impossible date/governorate, front≠back) — force a
re-scan, never save. `abstain` = checksum passed but uncorroborated — allow user
confirmation/edit. `accept` = independently corroborated. A new frontend must branch on
this, not on field presence.

### POST /egyptian-id-back — back of card
Body: raw image bytes.
```json
{ "success": true, "processing_time": 4.1,
  "extracted_data": { "national_id": "...", "marital_status": "...",
                      "occupation": "...", "issue_date": "...", "expiry_date": "..." } }
```
Cross-check `national_id` here against the front read (the front verdict improves when
you re-run with a matching back NID; the current app just compares client-side).

### POST /passport — MRZ passports
Raw image bytes → `{success, extracted_data...}`; `501` if the module isn't installed.

### POST /verify-face — face match + liveness
```json
// request
{ "id_image": "<base64>",            // the face_image crop from /egyptian-id
  "live_image": "<base64>",          // selfie
  "challenge_frames": ["<b64>", ...] // optional, ≤4 frames captured during a
}                                     // head-turn prompt → enables ACTIVE liveness
```
```json
// response (200)
{ "success": true,
  "verification_result": {
    "is_match": true,               // similarity >= threshold (default 75, FACE_THRESHOLD env)
    "similarity_score": 91.4,       // 0-100
    "distance": 0.32,               // raw ArcFace cosine distance
    "threshold": 75,
    "liveness_failed": false,
    "liveness_mode": "active | passive",
    "liveness_score": 118.6,        // Laplacian sharpness (passive component)
    "liveness_reason": "low_sharpness | no_motion | identity_changed" // when failed
  } }
```
Errors: `422 {"error", "error_code": "ERR_NO_FACE"}` (no face found / too dark /
multiple faces), `413`, `500 ERR_SERVER`. Pipeline: RetinaFace detection → ArcFace
embeddings → cosine similarity; active liveness checks that challenge frames show
real motion (embedding spread > 0.05) by the same person (spread < 0.68).

UX guidance for a new frontend: capture 3–4 challenge frames while prompting a head
turn — passive-only mode (no frames) is much weaker against photo/screen replay.

---

## 2. rust_backend canister — all state

Candid at [rust_backend.did](../rust_backend/rust_backend.did). Call with
`@dfinity/agent` / `@icp-sdk/core`. Two identities matter:
- **anonymous** — enough for the session-handoff calls and public queries;
- **II-authenticated principal** — required for user-owned actions; `is_admin_check()`
  gates the admin console; first admin is set via `set_admin(principal)`.

**Convention: JSON-as-text.** Most payloads are JSON serialized to a candid `text`.
Keys are client-chosen UUIDs. What follows is the practical protocol per feature.

### KYC submissions
- `submit_kyc(submission_id: text, json: text) -> Ok/Err` — the final result of a
  completed flow. The current app sends `{"kycData": {full_name, national_id,
  birth_date, age, address, governorate, gender, marital_status, occupation,
  phone_verified, faceVerified, ...}}` — the canister treats it as opaque JSON, so a
  new frontend may extend it (keep `national_id` present: dedup relies on it).
- `national_id_exists(nid) -> bool` (query) — pre-submit dedup check.
- `get_my_kyc_status(nid, phone) -> opt text` (query) — user-facing status lookup.
- Admin: `get_kyc_submissions_page(offset, limit)`, `get_kyc_submissions_count()`,
  `get_kyc_status_counts() -> (pending, approved, rejected)`,
  `update_kyc_status(id, status)`, `delete_kyc_submission(id)`.
- GDPR: `delete_my_kyc(nid, phone)` — user-initiated erasure;
  `log_consent_event(json)` — consent audit trail.

### Desktop→phone handoff sessions (the QR flow)
Protocol (all session ids are client-generated UUIDs; TTL **24 h**):
1. Desktop: `create_verification_session(session_id)` → show QR encoding
   `<origin>/mobile-verify/<session_id>` (any URL scheme a new frontend likes —
   the canister only cares about the id).
2. Phone: `verify_session(session_id) -> bool` (query) — gate the mobile page.
3. Phone: `mark_verification_in_progress(session_id)` on entry, then **every ~5 s as a
   heartbeat** (the desktop shows "in progress" while heartbeats arrive).
4. Desktop: poll `get_verification_status(session_id) -> opt text` (JSON:
   `{status: "pending|in_progress|completed|cancelled", created_at, completed_at,
   data}`).
5. Phone on finish: `complete_verification(session_id, kyc_json)` — desktop's next
   poll sees `status=completed` + the data, and continues to submit.
- Housekeeping: `delete_verification_session(id)`, `cleanup_expired_sessions()`.

### OCR result persistence (optional server-side flow)
`get_egyptian_id_ocr_and_save(image_b64_or_ref)` has the canister call the OCR server
via HTTPS outcall (`configure_ocr_server(url)` first) and store the result;
`get_egyptian_id_result(id)`, `get_all_egyptian_id_results()`, same for passports.
The current app doesn't use this path (it calls Flask directly) — but it's how you'd
build a frontend with zero direct OCR-server contact.

### File store
`upload(path, mime, bytes, complete)` / `add_document(...)` (chunked),
`list()`, `delete(path)` — user-scoped document storage on-chain.

### Audit + partner API
- `get_audit_log(n)` / `get_audit_log_page(offset, limit)` /
  `export_audit_log_range(from_ns, to_ns)` — append-only audit trail (admin).
- Partner/API-client flow: `register_api_client(name, redirect_url, webhook) ->
  (client_id, secret)`, `list_api_clients`, `set_api_client_status`,
  `delete_api_client`; plus `http_request`/`http_request_update` implement a small
  HTTP API on the canister itself for partner-initiated hosted sessions
  (`/verify/:sessionId` in the current app = a partner session opened by API).
- `configure_email(host, key)`, `configure_frontend_url(url)` — admin config.

### Agent setup — the one thing that keeps biting
Always construct `HttpAgent` with an **explicit `host`**:
- mainnet build → default boundary nodes;
- anything else → **`window.location.origin`** and make your dev server / reverse
  proxy forward `/api/*` to the replica (`127.0.0.1:4943`). Without this, agent-js
  silently defaults to mainnet whenever the page isn't on localhost (phones, tunnels)
  — every canister call then targets canisters that don't exist. Also call
  `agent.fetchRootKey()` on non-mainnet (await it before the first query, or the
  first calls can race certificate verification).

---

## 3. sms_verification canister — OTP

```
configure_twilio(sid, token, from)  -> {success, message}   // admin, once
set_encryption_key(key)             -> {success, message}   // admin, once
send_sms(phone)                     -> {success, message}   // sends the OTP
verify_otp(phone, code)             -> {success, message}   // checks it
get_verified_phones()               -> vec text
```
Anonymous calls are fine. `send_sms` fires a real Twilio message via HTTPS outcall —
without configured credentials it fails, so a new frontend should surface the
`message` on failure rather than assuming delivery.

---

## 4. Internet Identity

- Production (`DFX_NETWORK=ic`): point login at the production II URL — users get
  II 2.0 (passkeys / Google, no anchor numbers).
- Local dev: II 2.0 = **two** canisters (backend `rdmx6-...` + frontend/UI canister);
  the backend needs `new_flow_origins`/`related_origins` to include every origin the
  app is served from, and `dummy_auth` makes device-free testing possible. See
  `dfx.json` in this repo for the working local config.
- The login product is standard `@dfinity/auth-client`: `login({identityProvider})`
  → delegation → `authClient.getIdentity()` → pass as `agentOptions.identity`. The
  resulting principal is the user's on-chain identity; `is_admin_check()` routes
  admin UI.

---

## 5. The canonical end-to-end flow (what any frontend must orchestrate)

1. `GET /health` — bail early if OCR service is down.
2. *(optional)* II login → authenticated actor.
3. Front-of-ID capture → `POST /egyptian-id` → **branch on
   `extracted_data.verification.verdict`** (reject → re-scan; abstain → user
   confirm/edit; accept → proceed). Keep `face_image`.
4. Back-of-ID capture → `POST /egyptian-id-back` → compare `national_id`
   front vs back; mismatch → re-scan.
5. Selfie + 3–4 head-turn frames → `POST /verify-face` with the ID `face_image` →
   require `is_match && !liveness_failed`.
6. Phone OTP → `send_sms(phone)` → `verify_otp(phone, code)`.
7. `national_id_exists(nid)` → duplicate handling.
8. `submit_kyc(uuid, json)` (or `complete_verification(session_id, json)` if the flow
   ran on a phone via the QR handoff protocol in §2).
9. Status page → `get_my_kyc_status(nid, phone)`; admin approves via
   `update_kyc_status`.

Privacy invariants a new frontend must keep: never persist raw face images anywhere
except transiently for step 5 (the current app deliberately excludes `face_image`
from `submit_kyc`); consent events logged via `log_consent_event`; deletion via
`delete_my_kyc`.

---

## 6. Ops notes

- OCR service env: `FACE_THRESHOLD` (default 75), `TLS_CERT`/`TLS_KEY` (serve HTTPS
  directly; otherwise binds 127.0.0.1 plain HTTP and expects a fronting proxy),
  `GIT_COMMIT` (reported by /health).
- Serving currently uses YOLO field detectors + EasyOCR/Qari on CPU. A PaddleOCR
  swap (PP-OCRv6 det + arabic PP-OCRv5 rec) is benchmarked and pending integration —
  it changes nothing in this API contract, only accuracy/latency.
- Local bring-up: `dfx start` + `dfx deploy` (replica :4943), `ocr-service/.venv`
  python `server.py` (:5000), any static/dev server for the frontend with `/api` and
  the OCR routes proxied. Camera capture requires HTTPS or localhost.
