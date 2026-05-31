#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / LIVE CONTROL SURFACE"

printf 'CLICKABLE FEEDBACK TABS\n'
printf '  - FEEDBACK_CLOUD_VYRDX_ROOM\n'
printf '  - FEEDBACK_PIPELINE\n'
printf '  - FEEDBACK_RESPONSE\n'
printf '  - FEEDBACK_MONITOR\n'
printf '  - FEEDBACK_LIVE_CONTROL\n'

printf '\nCONTROL COMMANDS\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-feedback-cloud-room.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/feedback-cloud-room-report.sh"

printf '\nFOLDER MAP\n'
find "$ROOM_ROOT" -maxdepth 2 -mindepth 1 -type d | sort
