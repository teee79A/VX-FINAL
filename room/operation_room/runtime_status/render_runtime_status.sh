#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/operation_room"
# shellcheck source=/dev/null
source "$ROOT/operation_common.sh"

ensure_runtime
STATE_FILE="$ROOM_ROOT/runtime/state/latest_runtime_status.txt"

{
  printf 'captured_at=%s\n' "$(date -u '+%FT%TZ')"
  printf 'overall_status=%s\n' "$(ops_overall_status)"
  printf 'missing_count=%s\n' "$(ops_missing_count)"
} > "$STATE_FILE"

print_header "OPERATION_ROOM / RUNTIME STATUS"

printf 'LEGACY OPS SUMMARY\n'
if [[ -f "$OPS_STATUS_FILE" ]]; then
  jq -r '.summary // {}' "$OPS_STATUS_FILE" 2>/dev/null || true
else
  echo "ops status file missing"
fi

printf '\nENGINE STATUS\n'
print_engine_matrix

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nSNAPSHOT\n'
printf '  %s\n' "$STATE_FILE"
