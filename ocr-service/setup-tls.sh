#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# KYC OCR Server — TLS Setup (run once on the VPS as root)
#
# Prerequisites:
#   1. A domain (e.g. ocr.mercaturaforum.com) pointing to this server's IP
#   2. Port 80 open for Let's Encrypt ACME challenge
#   3. Python venv already set up in /root/kyc-ocr/
#
# After running this script, start the server with:
#   TLS_CERT=/etc/letsencrypt/live/<domain>/fullchain.pem \
#   TLS_KEY=/etc/letsencrypt/live/<domain>/privkey.pem \
#   python3 /root/kyc-ocr/server.py
#
# Then point the canister at the new URL (no redeploy needed):
#   dfx canister call rust_backend configure_ocr_server '("https://ocr.mercaturaforum.com:5000")' --network ic
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>   e.g.  $0 ocr.mercaturaforum.com"
  exit 1
fi

echo "▶ Installing certbot..."
apt-get update -qq && apt-get install -y certbot

echo "▶ Obtaining certificate for $DOMAIN (standalone mode)..."
# Stop any service on port 80 temporarily if needed
# systemctl stop nginx 2>/dev/null || true
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email admin@mercaturaforum.com \
  -d "$DOMAIN"

CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

echo "▶ Certificate issued:"
echo "   CERT: $CERT"
echo "   KEY:  $KEY"

echo "▶ Setting up auto-renewal cron..."
# Flask reads the cert only at startup, so renewal must fully RESTART the server.
# Prefers the systemd unit (see deploy/kyc-ocr.service); falls back to killing the
# process so start.sh's auto-restart loop brings it back with the new cert.
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl restart kyc-ocr 2>/dev/null || pkill -f server.py || true'") | crontab -

echo ""
echo "✅ TLS setup complete."
echo ""
echo "Start the OCR server with:"
echo "  TLS_CERT=$CERT TLS_KEY=$KEY python3 server.py"
echo ""
echo "Then point the canister at the new URL (admin, no redeploy needed):"
echo "  dfx canister call rust_backend configure_ocr_server '(\"https://$DOMAIN:5000\")' --network ic"
echo ""
echo "Recommended: install the systemd unit instead of running python directly —"
echo "  see deploy/kyc-ocr.service and deploy/monitor.sh"
