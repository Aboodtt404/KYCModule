#!/usr/bin/env bash
# KYC OCR Server — start with auto-restart on crash
# Usage: ./ocr-service/start.sh
# Runs until manually killed (Ctrl-C or kill <pid>).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin/activate"
SERVER="$SCRIPT_DIR/server.py"
LOG="$SCRIPT_DIR/ocr-server.log"
MAX_RESTARTS=10
RESTART_DELAY=5

if [ ! -f "$VENV" ]; then
  echo "[ERROR] Virtual environment not found at $VENV"
  echo "Run: cd ocr-service && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

source "$VENV"

restarts=0
echo "[OCR] Starting KYC OCR server on port 5000 — log: $LOG"

while true; do
  python3 "$SERVER" >> "$LOG" 2>&1
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "[OCR] Server exited cleanly."
    break
  fi

  restarts=$((restarts + 1))
  if [ $restarts -ge $MAX_RESTARTS ]; then
    echo "[OCR] Server crashed $MAX_RESTARTS times. Giving up. Check $LOG"
    exit 1
  fi

  echo "[OCR] Server crashed (exit $EXIT_CODE). Restart $restarts/$MAX_RESTARTS in ${RESTART_DELAY}s…"
  sleep "$RESTART_DELAY"
done
