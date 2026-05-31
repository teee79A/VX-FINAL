#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/commercial_room"
# shellcheck source=/dev/null
source "$ROOT/commercial_common.sh"

print_header "COMMERCIAL_ROOM / LIVE CONTROL SURFACE"

printf 'CLICKABLE ROOM SURFACES\n'
printf '  - COMMERCIAL_ROOM\n'
printf '  - COMMERCIAL_LIVE_CONTROL\n'
printf '  - COMMERCIAL_MONITOR\n'
printf '  - COMMERCIAL_EVIDENCE\n'
printf '\n'

printf 'FOLDER MAP\n'
find "$ROOM_ROOT" -maxdepth 2 -mindepth 1 -type d | sort

printf '\nENGINE REGISTRY\n'
print_tsv "$ROOM_ROOT/engine_registry.tsv"

printf '\nPRIMARY ACTIONS\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-commercial-room.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/commercial-room-report.sh"
