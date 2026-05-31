#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

print_header "ARCHIVING_ROOM / CHANGE HISTORY"

printf 'LATEST CHANGE FILES\n'
find "$ROOM_ROOT/change_history" -maxdepth 2 -type f \
  -printf '%TY-%Tm-%Td %TH:%TM:%TS %p\n' 2>/dev/null | sort -r | head -n 80

printf '\nLATEST ROOM EVENTS\n'
list_recent_files
