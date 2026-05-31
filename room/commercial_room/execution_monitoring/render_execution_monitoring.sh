#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/commercial_room"
# shellcheck source=/dev/null
source "$ROOT/commercial_common.sh"

print_header "COMMERCIAL_ROOM / EXECUTION MONITORING"

printf 'PROCESS STATUS\n'
print_process_matrix

printf '\nLISTEN PORTS (FILTERED)\n'
ss -ltn 2>/dev/null | rg -E ':(46080|19999|8123|6333|8500|8080|5678|7233|9092|9200)\b' || true

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nLATEST LOG FILES\n'
find "$ROOM_ROOT/execution_monitoring/logs" -maxdepth 1 -type f -printf '%TY-%Tm-%Td %TH:%TM:%TS %p\n' 2>/dev/null | sort -r | head -n 8 || true
