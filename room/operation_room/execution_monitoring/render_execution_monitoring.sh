#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/operation_room"
# shellcheck source=/dev/null
source "$ROOT/operation_common.sh"

print_header "OPERATION_ROOM / EXECUTION MONITORING"

printf 'PROCESS STATUS\n'
print_process_matrix

printf '\nLISTEN PORTS (FILTERED)\n'
ss -ltn 2>/dev/null | rg ':(46080|19999|8123|5678|8080|7233)\b' || true

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nEVENT BUS TAIL\n'
tail -n 25 "$COMMAND_AUDIT_FILE" 2>/dev/null || echo "no command bus audit yet"
