#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/commercial_room"
# shellcheck source=/dev/null
source "$ROOT/commercial_common.sh"

STATE_FILE="$ROOM_ROOT/runtime_status/state/latest_runtime_status.txt"

print_header "COMMERCIAL_ROOM / RUNTIME STATUS"

{
  printf 'captured_at=%s\n' "$(date -u '+%FT%TZ')"
  printf '\n[engines]\n'
  print_engine_matrix
  printf '\n[endpoints]\n'
  print_endpoint_matrix
} > "$STATE_FILE"

printf 'ENGINE STATUS\n'
print_engine_matrix

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nSNAPSHOT\n'
printf '  %s\n' "$STATE_FILE"
