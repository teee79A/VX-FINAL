#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/szh_central_brain"
# shellcheck source=/dev/null
source "$ROOT/szh_common.sh"

print_header "SZH_CENTRAL_BRAIN / OPERATOR ACTIONS"

printf 'ROOM CONTROL\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-central-brain.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/kitty-tv-wall.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/central-brain-report.sh"

printf '\nSTACK START / STATUS / STOP\n'
printf '  %-18s %s\n' "stack up" "/home/t79/KITTY/bin/kitty-up.sh"
printf '  %-18s %s\n' "stack status" "/home/t79/KITTY/bin/kitty-status.sh"
printf '  %-18s %s\n' "stack down" "/home/t79/KITTY/bin/kitty-down.sh"

printf '\nGATEWAY + MCP CONTROLS\n'
printf '  %-18s %s\n' "agentgateway up" "/home/t79/KITTY/bin/agentgateway-up.sh"
printf '  %-18s %s\n' "agentgateway status" "/home/t79/KITTY/bin/agentgateway-status.sh"
printf '  %-18s %s\n' "agentgateway down" "/home/t79/KITTY/bin/agentgateway-down.sh"
printf '  %-18s %s\n' "mcp linux up" "/home/t79/KITTY/bin/mcp-linux-admin-up.sh"
printf '  %-18s %s\n' "mcp time up" "/home/t79/KITTY/bin/mcp-time-calendar-up.sh"
printf '  %-18s %s\n' "mcp voice up" "/home/t79/KITTY/bin/mcp-voice-agent-up.sh"

printf '\nSINGLE EXIT PATH VIA AGENTGATEWAY\n'
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh stack.status '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh room.central_brain.open '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh mcp.linux.status '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh mcp.time.status '{}'"
printf '  %s\n' "/home/t79/KITTY/bin/agentgateway-request.sh mcp.voice.status '{}'"
