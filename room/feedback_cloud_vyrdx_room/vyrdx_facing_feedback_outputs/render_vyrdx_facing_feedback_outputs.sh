#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / VYRDX-FACING OUTPUTS"

printf 'OUTPUT CONNECTORS\n'
print_tsv "$ROOM_ROOT/connector_registry.tsv"

printf '\nOUTPUT ENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nOUTPUT ARTIFACTS\n'
printf '%-20s %-12s %s\n' "modified" "size(bytes)" "path"
printf '%s\n' "--------------------------------------------------------------------------------"
find "$ROOM_ROOT/vyrdx_facing_feedback_outputs" -type f \
  -printf '%TY-%Tm-%TdT%TH:%TM:%TS %s %p\n' 2>/dev/null | sort -r | head -n 150

printf '\nROOM AUDIT (TAIL)\n'
tail -n 30 "$ROOM_AUDIT_FILE" 2>/dev/null || echo "no feedback-room audit yet"
