# Mainnet Deployment Guide — KYC By Mercatura

Complete checklist for deploying to the Internet Computer mainnet (ic network).

---

## Prerequisites

- `dfx` installed (run `brew unlink rust` first to avoid toolchain conflict)
- ICP tokens in your cycles wallet (each canister deploy costs ~1–2 T cycles ≈ $1–2)
- Resend API key (for email notifications)
- OCR server domain with TLS cert (see `ocr-service/setup-tls.sh`)
- Twilio account SID, auth token, and phone number

---

## Step 1 — Build the frontend for production

```bash
echo "DFX_NETWORK='ic'" > .env
grep DFX_NETWORK .env          # must print: DFX_NETWORK='ic'

cd frontend
VITE_OCR_SERVER_URL=https://ocr.mercaturaforum.com:5000 npm run build
grep -c 'lqy7q' dist/assets/*.js   # must be >= 1 (canister ID present)
grep -c 'localhost' dist/assets/*.js  # must be 0
cd ..
```

## Step 2 — Deploy canisters to mainnet

```bash
# This costs cycles. Ensure your wallet is funded.
dfx identity use default
dfx wallet --network ic balance

# Deploy all canisters
dfx deploy --network ic
```

Canister IDs will be written to `canister_ids.json`. Save this file in version control.

## Step 3 — Configure secrets (one-time, after deploy)

### 3a. Encryption key for SMS canister
```bash
KEY=$(openssl rand -hex 32)
dfx canister call sms_verification_backend --network ic set_encryption_key "(\"$KEY\")"
# Store $KEY securely (password manager, not in code)
```

### 3b. Twilio credentials
```bash
dfx canister call sms_verification_backend --network ic configure_twilio \
  '("AC<your_account_sid>", "<your_auth_token>", "+<your_from_number>")'
```

### 3c. Admin principal
```bash
# Get your principal
dfx identity get-principal

# Register as admin (you are already controller, but this adds to ADMIN_MAP)
dfx canister call rust_backend --network ic set_admin \
  "(principal \"$(dfx identity get-principal)\")"
```

### 3d. Email notifications (optional)
```bash
dfx canister call rust_backend --network ic configure_email \
  '("re_<your_resend_api_key>", "kyc@mercaturaforum.com")'
```

## Step 4 — Start the OCR server with TLS

The active server is `ocr-service/server.py` (Flask, port 5000). Do **not** run `main.py` or `ocr_server.py` — those are deprecated.

```bash
# On the VPS (194.31.150.154):
cd /root/kyc-ocr
./setup-tls.sh ocr.mercaturaforum.com   # run once to get Let's Encrypt cert

ALLOWED_ORIGINS="https://$(dfx canister id frontend --network ic).icp0.io,https://kyc.mercaturaforum.com" \
TLS_CERT=/etc/letsencrypt/live/ocr.mercaturaforum.com/fullchain.pem \
TLS_KEY=/etc/letsencrypt/live/ocr.mercaturaforum.com/privkey.pem \
./start.sh
```

### 4b. Point the canister at the OCR server (no redeploy needed)

```bash
dfx canister call rust_backend --network ic configure_ocr_server \
  '("https://ocr.mercaturaforum.com:5000")'
```

This stores the URL in stable memory. Running `configure_ocr_server` again at any time updates it without redeploying.

## Step 5 — Verify the deployment

```bash
# Check canisters are running
dfx canister status rust_backend --network ic
dfx canister status sms_verification_backend --network ic
dfx canister status frontend --network ic

# Check OCR server health
curl https://ocr.mercaturaforum.com:5000/health

# Visit the frontend
echo "https://$(dfx canister id frontend --network ic).icp0.io"
```

## Step 6 — Post-deploy smoke test

1. Open the frontend URL in a browser
2. Navigate to `/user` → complete the KYC flow with a test ID
3. Navigate to `/admin` → log in with Internet Identity → verify submission appears
4. Approve the submission → verify email notification arrives
5. Check audit log shows all events

---

## Upgrade procedure (after code changes)

```bash
# Always upgrade, never reinstall (reinstall wipes stable memory)
dfx deploy rust_backend --network ic --mode upgrade
dfx deploy sms_verification_backend --network ic --mode upgrade
dfx deploy frontend --network ic   # frontend always reinstalls (stateless)
```

---

## Rollback procedure

```bash
# List recent WASM hashes
dfx canister info rust_backend --network ic

# Install a specific hash (from canister history)
dfx canister install rust_backend --network ic \
  --mode upgrade \
  --wasm path/to/previous.wasm
```

---

## Cycle top-up

```bash
# Check cycle balance
dfx canister status rust_backend --network ic | grep "Cycles"

# Top up from ICP
dfx ledger top-up $(dfx canister id rust_backend --network ic) \
  --amount 1.0 \
  --network ic
```

Canisters freeze when cycles run out. Set up monitoring alerts when balance drops below 1 T cycles.

---

## Environment variables summary

| Variable | Where to set | Value |
|---|---|---|
| `DFX_NETWORK` | `.env` | `'ic'` for prod, `'local'` for dev |
| `VITE_OCR_SERVER_URL` | Build env | `https://ocr.mercaturaforum.com:5000` |
| `ALLOWED_ORIGINS` | VPS environment (OCR server) | Comma-separated frontend origins |
| `TLS_CERT` / `TLS_KEY` | VPS environment (OCR server) | Let's Encrypt cert paths |
| OCR server URL | Canister stable memory | via `configure_ocr_server()` |
| Twilio credentials | Canister stable memory | via `configure_twilio()` |
| Resend API key | Canister stable memory | via `configure_email()` |
| Encryption key | Canister stable memory | via `set_encryption_key()` |
