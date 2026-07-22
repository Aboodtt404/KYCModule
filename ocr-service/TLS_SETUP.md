# OCR Server — Production Deployment Runbook (TLS + systemd + monitoring)

## Why TLS is a hard launch blocker

1. **Camera access**: browsers only expose `getUserMedia` (ID capture + selfie) on
   HTTPS origins. Without TLS the entire KYC flow is dead on a real phone.
2. **ICP outcalls**: mainnet canister HTTP outcalls require a certificate from a
   trusted CA. Self-signed certs are rejected by the IC replica.

## One-time VPS setup (run as root)

```bash
# 0. Prereqs: DNS A record  ocr.mercaturaforum.com → VPS IP, port 80 + 5000 open

# 1. Issue the certificate + install the auto-renew cron
cd /root/kyc-ocr
./setup-tls.sh ocr.mercaturaforum.com

# 2. Install the systemd unit (edit paths/env inside first)
cp deploy/kyc-ocr.service /etc/systemd/system/kyc-ocr.service
nano /etc/systemd/system/kyc-ocr.service   # set ALLOWED_ORIGINS to the real frontend domain
systemctl daemon-reload
systemctl enable --now kyc-ocr
journalctl -u kyc-ocr -f                    # watch first boot — model load takes ~1 min

# 3. Install the uptime monitor (checks /health every 2 min, restarts + alerts)
cp deploy/monitor.sh /usr/local/bin/kyc-ocr-monitor.sh
chmod +x /usr/local/bin/kyc-ocr-monitor.sh
# Optional alerts: export ALERT_WEBHOOK=<slack/discord webhook> in the cron line
( crontab -l; echo '*/2 * * * * ALERT_WEBHOOK="" /usr/local/bin/kyc-ocr-monitor.sh' ) | crontab -

# 4. Point the canister at the HTTPS URL (admin identity, no redeploy)
dfx canister call rust_backend configure_ocr_server '("https://ocr.mercaturaforum.com:5000")' --network ic
```

## Verification checklist (do all of these after setup)

- [ ] `curl https://ocr.mercaturaforum.com:5000/health` returns 200 from your laptop
- [ ] `echo | openssl s_client -connect ocr.mercaturaforum.com:5000 2>/dev/null | openssl x509 -noout -dates` shows a valid window
- [ ] Open the production frontend **on a real phone**, complete one full KYC run:
      ID scan → review → OTP → face verification (head-turn) → submit
- [ ] QR handoff: start on desktop, scan QR, finish on phone, confirm data lands on desktop
- [ ] `systemctl stop kyc-ocr` → within 4 min the monitor restarts it and (if configured) alerts
- [ ] `certbot renew --dry-run` succeeds

## Environment variables (read by server.py)

| Var | Required in prod | Notes |
|---|---|---|
| `TLS_CERT` / `TLS_KEY` | yes | Let's Encrypt fullchain + privkey paths; server binds 0.0.0.0 only when set |
| `ALLOWED_ORIGINS` | yes | Comma-separated; must NOT contain localhost/127.0.0.1 (server warns) |
| `FACE_THRESHOLD` | no | Default 75; clamped to [30, 99] |
| `REDIS_URL` | recommended | Shared rate-limit state across restarts |
| `ALLOW_LOCALHOST` | no | Set to 1 only in dev to silence the origins warning |

## Renewal

`setup-tls.sh` installs a cron that runs `certbot renew` nightly at 03:00 and
**fully restarts** the service on renewal (Flask reads certs only at startup —
a reload signal is not enough).

## Local development

No TLS needed: the Vite proxy routes `/egyptian-id`, `/passport`, `/verify-face`
to `http://127.0.0.1:5000`, and the browser talks to the OCR server directly.
Canister outcalls are only used on mainnet.
