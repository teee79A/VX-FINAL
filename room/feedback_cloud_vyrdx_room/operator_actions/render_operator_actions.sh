#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / OPERATOR ACTIONS"

printf 'ROOM CONTROL\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-feedback-cloud-room.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/feedback-cloud-room-report.sh"

printf '\nENGINE START COMMANDS\n'
printf '  %-20s %s\n' "hookdeck" "hookdeck listen --port 3100"
printf '  %-20s %s\n' "n8n" "n8n start --host 127.0.0.1 --port 5678"
printf '  %-20s %s\n' "tenderly" "tenderly login && tenderly monitor"
printf '  %-20s %s\n' "radar" "radar --help"
printf '  %-20s %s\n' "agentgateway" "python3 /home/t79/KITTY/bin/agentgateway.py"

printf '\nENGINE STOP COMMANDS\n'
printf '  %-20s %s\n' "hookdeck" "pkill -f 'hookdeck'"
printf '  %-20s %s\n' "n8n" "pkill -f 'n8n'"
printf '  %-20s %s\n' "tenderly" "pkill -f 'tenderly'"
printf '  %-20s %s\n' "radar" "pkill -f 'radar'"
printf '  %-20s %s\n' "agentgateway" "pkill -f 'agentgateway.py'"
