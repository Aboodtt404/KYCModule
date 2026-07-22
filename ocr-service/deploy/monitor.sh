#!/usr/bin/env bash
# KYC OCR Server — uptime monitor
#
# Checks /health and alerts when the server is down or degraded.
# Restarts the systemd service after consecutive failures.
#
# Install (on the VPS, as root):
#   cp monitor.sh /usr/local/bin/kyc-ocr-monitor.sh && chmod +x /usr/local/bin/kyc-ocr-monitor.sh
#   crontab -e   →   */2 * * * * /usr/local/bin/kyc-ocr-monitor.sh
#
# Alerting: set ALERT_WEBHOOK to a Slack/Discord/Mattermost incoming-webhook URL,
# or ALERT_EMAIL to an address (requires a configured `mail` command).

set -u

HEALTH_URL="${HEALTH_URL:-https://ocr.mercaturaforum.com:5000/health}"
SERVICE_NAME="${SERVICE_NAME:-kyc-ocr}"
STATE_FILE="/var/run/kyc-ocr-monitor.state"
FAILS_BEFORE_RESTART=2
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

alert() {
  local msg="[KYC-OCR monitor] $1 ($(date -u '+%Y-%m-%d %H:%M:%S UTC'))"
  logger -t kyc-ocr-monitor "$msg"
  if [[ -n "$ALERT_WEBHOOK" ]]; then
    curl -s -m 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\": \"$msg\"}" "$ALERT_WEBHOOK" >/dev/null || true
  fi
  if [[ -n "$ALERT_EMAIL" ]] && command -v mail >/dev/null; then
    echo "$msg" | mail -s "KYC OCR alert" "$ALERT_EMAIL" || true
  fi
}

fails=0
[[ -f "$STATE_FILE" ]] && fails=$(cat "$STATE_FILE" 2>/dev/null || echo 0)

if curl -sf -m 15 "$HEALTH_URL" >/dev/null; then
  # Recovered after previous failures → notify once
  if (( fails >= FAILS_BEFORE_RESTART )); then
    alert "Server recovered — /health is responding again."
  fi
  echo 0 > "$STATE_FILE"
  exit 0
fi

fails=$((fails + 1))
echo "$fails" > "$STATE_FILE"

if (( fails == FAILS_BEFORE_RESTART )); then
  alert "Health check failed ${fails}x — restarting ${SERVICE_NAME}."
  systemctl restart "$SERVICE_NAME" || alert "systemctl restart ${SERVICE_NAME} FAILED — manual intervention needed."
elif (( fails > FAILS_BEFORE_RESTART )); then
  alert "Server STILL down after restart (failure #${fails}) — manual intervention needed."
fi
