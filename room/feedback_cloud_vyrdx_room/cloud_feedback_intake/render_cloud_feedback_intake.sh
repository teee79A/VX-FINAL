#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / CLOUD FEEDBACK INTAKE"

printf 'INGRESS TOOLS\n'
printf '%-20s | %-7s | %s\n' "engine" "state" "binary"
printf '%s\n' "--------------------------------------------------------------------"
check_cmd "hookdeck" "hookdeck" "/home/t79/.local/bin/hookdeck"
check_cmd "n8n" "n8n" "/home/t79/.local/bin/n8n"
check_cmd "mcp" "mcp" "/home/t79/.local/bin/mcp"

printf '\nINTAKE ENDPOINTS\n'
printf '%-20s | %-4s | %s\n' "service" "state" "endpoint"
printf '%s\n' "--------------------------------------------------------------------"
check_http "n8n" "http://127.0.0.1:5678/healthz"
check_http "agentgateway" "http://127.0.0.1:46080/health"

printf '\nINTAKE ARTIFACTS\n'
printf '%-20s %-12s %s\n' "modified" "size(bytes)" "path"
printf '%s\n' "--------------------------------------------------------------------------------"
find "$ROOM_ROOT/cloud_feedback_intake" -type f \
  -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort -r | head -n 120

printf '\nCOMMAND BUS FEEDBACK EVENTS\n'
if [[ -f "$COMMAND_AUDIT_FILE" ]]; then
  rg -i 'feedback|hook|webhook|ingress' "$COMMAND_AUDIT_FILE" | tail -n 30 || true
else
  echo "no command bus audit yet"
fi
