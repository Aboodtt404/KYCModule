#!/usr/bin/env bash
# KYC canister backup — exports ALL submissions (paged) + audit log to local JSON.
#
# Stable memory survives upgrades only if pre_upgrade/post_upgrade are correct;
# this snapshot is the insurance policy for a botched upgrade or canister loss.
#
# Usage:
#   ./scripts/backup-kyc.sh                                       # ic mainnet, current identity
#   ./scripts/backup-kyc.sh --network local                       # local replica
#   ./scripts/backup-kyc.sh --network ic --identity kyc-admin     # explicit admin identity
#
# Cron (daily 02:00, keeps KEEP_DAYS days):
#   0 2 * * * cd /path/to/KYC && ./scripts/backup-kyc.sh --network ic --identity kyc-admin >> /var/log/kyc-backup.log 2>&1
#
# SECURITY: backups contain PII (names, national IDs, phone numbers).
# Store on an encrypted volume; files are written chmod 600.
#
# Requires: dfx, jq

set -euo pipefail

NETWORK="ic"
IDENTITY=""
CANISTER="rust_backend"
PAGE_SIZE=100
KEEP_DAYS=30
OUTDIR="$(cd "$(dirname "$0")/.." && pwd)/backups"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)  NETWORK="$2";  shift 2 ;;
    --identity) IDENTITY="$2"; shift 2 ;;
    --out)      OUTDIR="$2";   shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

command -v dfx >/dev/null || { echo "ERROR: dfx not found in PATH" >&2; exit 1; }
command -v jq  >/dev/null || { echo "ERROR: jq not found in PATH"  >&2; exit 1; }

IDENTITY_ARGS=()
[[ -n "$IDENTITY" ]] && IDENTITY_ARGS=(--identity "$IDENTITY")

mkdir -p "$OUTDIR"
chmod 700 "$OUTDIR"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H-%M-%S')"
DEST="$OUTDIR/$TIMESTAMP"
mkdir -p "$DEST"

call() {
  dfx canister ${IDENTITY_ARGS[@]+"${IDENTITY_ARGS[@]}"} call "$CANISTER" "$1" "$2" --network "$NETWORK" --output json
}

# ── 1. KYC submissions — paged so backups don't silently truncate at 500 ─────
echo "[backup] Exporting KYC submissions (network: $NETWORK)…"
offset=0
total=-1
echo "[]" > "$DEST/submissions.json"
while true; do
  page="$(call get_kyc_submissions_page "(${PAGE_SIZE}:nat64, ${offset}:nat64)")"
  page_total="$(echo "$page" | jq -r '.[0]' | tr -d '_')"
  items="$(echo "$page" | jq '[ .[1][] | { id: .[0], data: (.[1] | try fromjson catch .[1]) } ]')"
  count="$(echo "$items" | jq 'length')"

  [[ $total -lt 0 ]] && total=$page_total
  jq --argjson new "$items" '. + $new' "$DEST/submissions.json" > "$DEST/.tmp.json" \
    && mv "$DEST/.tmp.json" "$DEST/submissions.json"

  offset=$((offset + count))
  echo "[backup]   $offset / $total submissions"
  [[ $count -eq 0 || $offset -ge $total ]] && break
done

# ── 2. Audit log — full range (server caps each call at 10k entries) ─────────
echo "[backup] Exporting audit log…"
NOW_NS=$(( $(date +%s) * 1000000000 ))
call export_audit_log_range "(0:nat64, ${NOW_NS}:nat64)" \
  | jq '[ .[] | { key: .[0], entry: (.[1] | try fromjson catch .[1]) } ]' \
  > "$DEST/audit-log.json"
audit_count="$(jq 'length' "$DEST/audit-log.json")"
echo "[backup]   $audit_count audit entries"
if [[ "$audit_count" -ge 10000 ]]; then
  echo "[backup]   WARNING: hit the 10k per-call cap — entries beyond it were NOT exported. Export older ranges in chunks." >&2
fi

# ── 3. Compress, lock down, prune ─────────────────────────────────────────────
ARCHIVE="$OUTDIR/kyc-backup-$TIMESTAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$OUTDIR" "$TIMESTAMP"
rm -rf "$DEST"
chmod 600 "$ARCHIVE"
find "$OUTDIR" -name 'kyc-backup-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "[backup] Done → $ARCHIVE ($total submissions, $audit_count audit entries)"
