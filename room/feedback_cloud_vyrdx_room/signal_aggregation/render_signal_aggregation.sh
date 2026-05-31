#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / SIGNAL AGGREGATION"

printf 'AGGREGATION ENGINE STATUS\n'
printf '%-20s | %-7s | %s\n' "engine" "state" "binary"
printf '%s\n' "--------------------------------------------------------------------"
check_cmd "radar" "radar" "/home/t79/.local/bin/radar"
check_cmd "tenderly" "tenderly" "/home/t79/.local/bin/tenderly"
check_cmd "clickhouse-client" "clickhouse-client" "/usr/bin/clickhouse-client"
check_cmd "qdrant-client" "qdrant-client" "/home/t79/.local/bin/qdrant-client"

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nAGGREGATED SIGNAL ARTIFACTS\n'
printf '%-20s %-12s %s\n' "modified" "size(bytes)" "path"
printf '%s\n' "--------------------------------------------------------------------------------"
find "$ROOM_ROOT/signal_aggregation" -type f \
  -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort -r | head -n 120

printf '\nEVENT STREAM (TAIL)\n'
if [[ -f "$COMMAND_AUDIT_FILE" ]]; then
  rg -i 'signal|aggregate|feedback' "$COMMAND_AUDIT_FILE" | tail -n 30 || true
else
  echo "no command bus audit yet"
fi
