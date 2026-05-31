#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / EXECUTION MONITORING"

printf 'PROCESS STATUS\n'
print_process_matrix

printf '\nLISTEN PORTS (FILTERED)\n'
ss -ltn 2>/dev/null | rg ':(46080|19999|8123|5678|6333|3100)\b' || true

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nCOMMAND BUS FEEDBACK EVENTS\n'
if [[ -f "$COMMAND_AUDIT_FILE" ]]; then
  rg -i 'feedback|hook|webhook|signal|vyrdx' "$COMMAND_AUDIT_FILE" | tail -n 35 || true
else
  echo "no command bus audit yet"
fi
