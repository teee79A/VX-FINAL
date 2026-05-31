#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/szh_central_brain"
# shellcheck source=/dev/null
source "$ROOT/szh_common.sh"

print_header "SZH_CENTRAL_BRAIN / LIVE CONTROL SURFACE"

printf 'FOLDER MAP\n'
find "$ROOM_ROOT" -maxdepth 2 -mindepth 1 -type d | sort

printf '\nPRIMARY ROOM COMMANDS\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-central-brain.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/central-brain-report.sh"
printf '  %s\n' "/home/t79/KITTY/bin/kitty-tv-wall.sh --reset"

printf '\nSINGLE EXIT PATH COMMANDS (AGENTGATEWAY)\n'
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh stack.status '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh room.central_brain.open '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh mcp.linux.status '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh mcp.time.status '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh mcp.voice.status '{}'"

printf '\nMANIFEST PRESENCE\n'
print_manifest_matrix
