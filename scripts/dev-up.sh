#!/usr/bin/env bash
# dev-up.sh — bring the whole KYC dev stack up behind fresh Cloudflare quick tunnels.
# Idempotent: healthy services are left alone; tunnels are always (re)created and the
# II canisters are re-pointed at the new URLs. Prints the app URL at the end.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FE="$ROOT/frontend"
LOG() { printf '\e[36m[dev-up]\e[0m %s\n' "$*"; }

# ── 0. replica ────────────────────────────────────────────────────────────────
if ! dfx ping >/dev/null 2>&1; then
  LOG "starting local replica"
  (cd "$ROOT" && dfx start --background >/dev/null 2>&1)
fi

# ── 1a. PaddleOCR sidecar (:5001) — must be up before the OCR server pings it ──
if ! curl -s -m 2 http://127.0.0.1:5001/health >/dev/null 2>&1; then
  LOG "starting PP sidecar"
  (cd "$ROOT/ocr-service" && setsid nohup ./.venv/bin/python pp_service.py >> pp_service.log 2>&1 < /dev/null &)
  for i in $(seq 1 30); do curl -s -m 2 http://127.0.0.1:5001/health >/dev/null 2>&1 && break; sleep 3; done
fi

# ── 1b. OCR server (:5000) ────────────────────────────────────────────────────
if ! curl -s -m 2 http://127.0.0.1:5000/health >/dev/null 2>&1; then
  LOG "starting OCR server"
  (cd "$ROOT/ocr-service" && setsid nohup ./.venv/bin/python server.py >> server.log 2>&1 < /dev/null &)
fi

# ── 2. vite (:3000 legacy app, :3001 hawiya) ─────────────────────────────────
if ! curl -s -m 2 http://127.0.0.1:3000 -o /dev/null 2>/dev/null; then
  LOG "starting vite (legacy)"
  (cd "$FE" && setsid nohup "$ROOT/node_modules/.bin/vite" --port 3000 > vite.log 2>&1 < /dev/null &)
fi
if ! curl -s -m 2 http://127.0.0.1:3001 -o /dev/null 2>/dev/null; then
  LOG "starting vite (hawiya)"
  (cd "$ROOT/frontend-hawiya" && setsid nohup "$ROOT/node_modules/.bin/vite" --port 3001 > vite.log 2>&1 < /dev/null &)
fi

# ── 3. II host-rewrite proxy (:8943) ─────────────────────────────────────────
if ! curl -s -m 2 http://127.0.0.1:8943/ -o /dev/null 2>/dev/null; then
  LOG "starting II host-rewrite proxy"
  setsid nohup python3 "$FE/ii-host-proxy.py" > "$FE/ii-proxy.log" 2>&1 < /dev/null &
fi

# ── 4. tunnels (always recreated) ────────────────────────────────────────────
LOG "restarting cloudflared quick tunnels"
pkill -f "instance-tools/bin/cloudflared tunnel.*(3000|3001|8943)" 2>/dev/null
sleep 1
HFE="$ROOT/frontend-hawiya"
setsid nohup cloudflared tunnel --protocol http2 --url http://127.0.0.1:3000 > "$FE/tunnel.log"     2>&1 < /dev/null &
setsid nohup cloudflared tunnel --protocol http2 --url http://127.0.0.1:3001 > "$HFE/tunnel.log"    2>&1 < /dev/null &
setsid nohup cloudflared tunnel --protocol http2 --url http://127.0.0.1:8943 > "$FE/tunnel-ii.log"  2>&1 < /dev/null &

url_from() { grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$1" | head -1; }
for i in $(seq 1 45); do
  APP_URL=$(url_from "$FE/tunnel.log" || true); II_URL=$(url_from "$FE/tunnel-ii.log" || true)
  HAWIYA_URL=$(url_from "$HFE/tunnel.log" || true)
  grep -q "Registered tunnel connection" "$FE/tunnel.log" 2>/dev/null && \
  grep -q "Registered tunnel connection" "$FE/tunnel-ii.log" 2>/dev/null && \
  grep -q "Registered tunnel connection" "$HFE/tunnel.log" 2>/dev/null && \
  [ -n "${APP_URL:-}" ] && [ -n "${II_URL:-}" ] && [ -n "${HAWIYA_URL:-}" ] && break
  sleep 2
done
[ -n "${APP_URL:-}" ] && [ -n "${II_URL:-}" ] || { LOG "FATAL: tunnels did not register"; exit 1; }
LOG "app    : $APP_URL"
LOG "hawiya : ${HAWIYA_URL:-<none>}"
LOG "ii     : $II_URL"

# ── 5. frontend env (vite watches .env.local and restarts itself) ────────────
printf 'VITE_II_URL=%s\n' "$II_URL" > "$FE/.env.local"
printf 'VITE_II_URL=%s\n' "$II_URL" > "$ROOT/frontend-hawiya/.env.local"

# ── 6. re-point the II canisters at the new origins ──────────────────────────
LOG "updating II backend origins (upgrade, keeps state)"
(cd "$ROOT" && dfx deploy internet_identity --upgrade-unchanged --argument "(opt record {
  captcha_config = opt record { max_unsolved_captchas = 50 : nat64;
    captcha_trigger = variant { Static = variant { CaptchaDisabled } } };
  dummy_auth = opt opt record { prompt_for_index = false };
  new_flow_origins = opt vec { \"$APP_URL\"; \"$HAWIYA_URL\"; \"http://127.0.0.1:3000\"; \"http://127.0.0.1:3001\" }
})" >/dev/null 2>&1) && LOG "ii backend ok" || LOG "WARN: ii backend upgrade failed"

LOG "updating II frontend config (upgrade)"
(cd "$ROOT" && dfx deploy internet_identity_frontend --upgrade-unchanged --argument "(record {
  backend_canister_id = principal \"rdmx6-jaaaa-aaaaa-aaadq-cai\";
  backend_origin = \"$II_URL\";
  related_origins = opt vec { \"$APP_URL\"; \"$HAWIYA_URL\"; \"http://127.0.0.1:3000\"; \"http://127.0.0.1:3001\" };
  fetch_root_key = opt true;
  analytics_config = opt null;
  dummy_auth = opt opt record { prompt_for_index = false };
  dev_csp = opt true;
  featured_dashboard_apps = opt vec {};
  feature_flags = opt vec {}
})" >/dev/null 2>&1) && LOG "ii frontend ok" || LOG "WARN: ii frontend upgrade failed"

# ── 7. wait for health end-to-end ─────────────────────────────────────────────
LOG "waiting for OCR model load (first boot can take ~2 min)"
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:5000/health >/dev/null 2>&1 && break; sleep 5; done
sleep 2
printf '\n  \e[1mAPP    : %s\e[0m\n  \e[1mHAWIYA : %s\e[0m\n  II     : %s\n  OCR    : %s/health\n\n' "$APP_URL" "${HAWIYA_URL:-<none>}" "$II_URL" "$APP_URL"
