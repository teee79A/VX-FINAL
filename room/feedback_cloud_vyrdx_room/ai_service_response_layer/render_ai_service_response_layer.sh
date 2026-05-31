#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / AI SERVICE RESPONSE LAYER"

printf 'RESPONSE ENGINE STATUS\n'
printf '%-20s | %-7s | %s\n' "engine" "state" "binary"
printf '%s\n' "--------------------------------------------------------------------"
check_cmd "mcp" "mcp" "/home/t79/.local/bin/mcp"
check_cmd "n8n" "n8n" "/home/t79/.local/bin/n8n"
check_cmd "tenderly" "tenderly" "/home/t79/.local/bin/tenderly"

printf '\nRESPONSE ENDPOINT STATUS\n'
printf '%-20s | %-4s | %s\n' "service" "state" "endpoint"
printf '%s\n' "--------------------------------------------------------------------"
check_http "agentgateway" "http://127.0.0.1:46080/health"
check_http "n8n" "http://127.0.0.1:5678/healthz"

printf '\nRESPONSE ARTIFACTS\n'
printf '%-20s %-12s %s\n' "modified" "size(bytes)" "path"
printf '%s\n' "--------------------------------------------------------------------------------"
find "$ROOM_ROOT/ai_service_response_layer" -type f \
  -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort -r | head -n 120

printf '\nMODULE ACTIONS (TAIL)\n'
tail -n 30 "$MODULE_JOURNAL_FILE" 2>/dev/null || echo "no module journal yet"
