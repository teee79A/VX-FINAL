#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

STATE_FILE="$ROOM_ROOT/runtime/state/rollback_reference_state.txt"

print_header "ARCHIVING_ROOM / ROLLBACK REFERENCE STATE"

if [[ -f "$STATE_FILE" ]]; then
  printf 'state_file: %s\n\n' "$STATE_FILE"
  sed -n '1,120p' "$STATE_FILE"
else
  printf 'state_file: %s\n' "$STATE_FILE"
  printf 'status: missing (set after first rollback pin)\n'
fi

printf '\nROLLBACK ARTIFACTS\n'
find "$ROOM_ROOT/rollback_reference_state" -type f \
  -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort -r | head -n 120
