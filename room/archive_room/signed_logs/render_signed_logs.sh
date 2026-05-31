#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

print_header "ARCHIVING_ROOM / SIGNED LOGS"

printf '%-20s %-12s %s\n' "modified" "size(bytes)" "path"
printf '%s\n' "--------------------------------------------------------------------------------"
find "$ROOM_ROOT/signed_logs" -type f \
  -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort -r | head -n 120
