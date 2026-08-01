# Partner API — hosted KYC in three calls

Any app can use this module as its KYC: create a session server-side, send the
user to `verification_url`, receive a signed webhook (or poll) when they finish.
All endpoints are plain HTTPS/JSON served straight from the canister — on
mainnet the base URL is `https://<canister-id>.icp0.io`; locally
`http://<canister-id>.localhost:4943`.

## 1. Get credentials

```
register_api_client(name, website, contact_email) -> (client_id, api_key)
```
Self-service (canister call, once). The `kyc_live_…` key is shown ONCE — only
its SHA-256 hash is stored. New clients start `pending`; an admin activates
with `set_api_client_status(client_id, "active")`.

## 2. Configure your webhook (optional but recommended)

```
POST /api/v1/webhook
Authorization: Bearer <api_key>
{"url": "https://yourapp.example/kyc-hook"}
```
Returns `webhook_secret` (`whsec_…`) — store it; calling again rotates it.
Empty `url` unsubscribes. Every delivery carries:

```
X-KYC-Event:     kyc.session.completed | kyc.review.completed | kyc.session.expired
X-KYC-Delivery:  wh_000000000042          (dedupe on this — delivery is at-least-once)
X-KYC-Signature: sha256=<hex hmac-sha256(webhook_secret, raw_body)>
```
Header names arrive lowercase. Verify with a constant-time compare. Retries:
1m, 5m, 30m, 2h, 6h after the first failure, then the delivery is parked
(admins: `list_webhook_queue`).

## 3. Create a session

```
POST /api/v1/sessions
Authorization: Bearer <api_key>
{"redirect_url": "https://yourapp.example/kyc/done",   // optional
 "metadata": "your-user-42"}                            // optional, echoed back

201 -> {"session_id": "api_…", "verification_url": "https://…/verify/api_…",
        "expires_in_seconds": 86400}
```
Open `verification_url` for the user (system browser recommended — camera
permissions are cleanest there). Sessions idle-expire after 10 minutes without
activity and hard-expire after 24h. After submitting, the user sees a
"Return to the app" button that opens
`redirect_url?kyc_session_id=…&kyc_status=received`.

## 4. Consume the result — `kyc.v1`

The webhook `data` field and `GET /api/v1/sessions/{id}` `.result` carry the
same versioned object (additive changes only; breaking changes become kyc.v2):

```json
{
  "schema": "kyc.v1",
  "session_id": "api_…",
  "status": "received | approved | rejected",
  "metadata": "your-user-42",
  "document": { "type": "national_id | passport", "full_name": "…",
                "national_id": "…", "birth_date": "…", "gender": "…",
                "address": "…", "expiry_date": "…",
                "passport_number": "… (passport only)",
                "mrz_valid_score": 1.0 },
  "checks": [ {"name": "ocr_verdict",        "result": "accept|abstain|reject"},
              {"name": "front_back_match",   "result": "pass|fail|not_available"},
              {"name": "barcode_strip",      "result": "pass|decoded|not_available"},
              {"name": "document_liveness",  "result": "card-like|flat|screen-like|not_available"} ],
  "face":  { "similarity": 87.4, "liveness_mode": "challenge" },
  "phone": { "number": "+20…", "verified": true },
  "user_edited": []
}
```

`kyc.session.completed` fires when the user submits (`status: received`);
`kyc.review.completed` fires when a human reviewer decides
(`status: approved|rejected`). Poll `GET /api/v1/sessions/{id}` any time —
wrong or inactive keys get 403, other partners' sessions read as 404.

## Local development

`configure_insecure_webhooks(true)` (controller only) permits `http://`
webhook targets. Never enable on mainnet.
