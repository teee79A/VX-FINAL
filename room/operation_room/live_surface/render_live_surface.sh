#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/operation_room"
# shellcheck source=/dev/null
source "$ROOT/operation_common.sh"

print_header "OPERATION_ROOM / LIVE CONTROL SURFACE"

printf 'CLICKABLE OPERATION TABS\n'
printf '  - OPERATION_ROOM\n'
printf '  - OPERATION_LIVE_CONTROL\n'
printf '  - OPERATION_MEDIA_PLASMA\n'
printf '  - OPERATION_MONITOR\n'
printf '  - OPERATION_EVIDENCE\n'

printf '\nPRIMARY CONTROL COMMANDS\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-operation-room.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/operation-room-report.sh"

printf '\nROOM MAP\n'
find "$ROOM_ROOT" -maxdepth 2 -mindepth 1 -type d | sort
