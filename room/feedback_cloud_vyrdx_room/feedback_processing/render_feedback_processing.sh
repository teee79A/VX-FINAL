#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / FEEDBACK PROCESSING"

printf 'PROCESSING ENGINE STATUS\n'
printf '%-20s | %-7s | %s\n' "engine" "state" "binary"
printf '%s\n' "--------------------------------------------------------------------"
check_cmd "n8n" "n8n" "/home/t79/.local/bin/n8n"
check_cmd "octosql" "octosql" "/home/t79/.local/bin/octosql"
check_cmd "steampipe" "steampipe" "/home/t79/.local/bin/steampipe"

printf '\nPROCESS STATUS\n'
print_process_matrix

printf '\nPROCESSING ARTIFACTS\n'
printf '%-20s %-12s %s\n' "modified" "size(bytes)" "path"
printf '%s\n' "--------------------------------------------------------------------------------"
find "$ROOM_ROOT/feedback_processing" -type f \
  -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort -r | head -n 120

printf '\nMODULE ACTIONS (TAIL)\n'
tail -n 30 "$MODULE_JOURNAL_FILE" 2>/dev/null || echo "no module journal yet"
