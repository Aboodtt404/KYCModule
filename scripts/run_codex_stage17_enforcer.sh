#!/usr/bin/env bash
set -euo pipefail

repo=/home/wael/projects/KYC-By-Mercatura
prompt_file="$repo/CODEX-ENFORCER-STAGE17-PROMPT.md"
prompt="$(cat "$prompt_file")"

exec codex \
  --no-alt-screen \
  --sandbox danger-full-access \
  --search \
  -a never \
  -C "$repo" \
  "$prompt"
