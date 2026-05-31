#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/szh_central_brain"
# shellcheck source=/dev/null
source "$ROOT/szh_common.sh"

print_header "SZH_CENTRAL_BRAIN / EXECUTION MONITORING"

printf 'PROCESS STATUS\n'
print_process_matrix

printf '\nLISTEN PORTS (FILTERED)\n'
ss -ltn 2>/dev/null | rg ':(46080|8877|8792|8790|19999|8123|5678|8080|7233)\b' || true

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nCOMMAND BUS TAIL\n'
tail -n 30 "$COMMAND_AUDIT_FILE" 2>/dev/null || echo "no command bus audit yet"

printf '\nMODULE JOURNAL TAIL\n'
tail -n 30 "$MODULE_JOURNAL_FILE" 2>/dev/null || echo "no module journal yet"
