#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room"
# shellcheck source=/dev/null
source "$ROOT/feedback_common.sh"

ensure_runtime
STATE_FILE="$ROOM_ROOT/runtime/state/latest_runtime_status.txt"
{
  printf 'captured_at=%s\n' "$(date -u '+%FT%TZ')"
  printf 'intake_files=%s\n' "$(section_file_count cloud_feedback_intake)"
  printf 'processing_files=%s\n' "$(section_file_count feedback_processing)"
  printf 'aggregation_files=%s\n' "$(section_file_count signal_aggregation)"
  printf 'response_files=%s\n' "$(section_file_count ai_service_response_layer)"
  printf 'output_files=%s\n' "$(section_file_count vyrdx_facing_feedback_outputs)"
} > "$STATE_FILE"

print_header "FEEDBACK_CLOUD_VYRDX_ROOM / RUNTIME STATUS"

printf 'FILE COUNTS\n'
list_sections

printf '\nENGINE STATUS\n'
print_engine_matrix

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nPROCESS STATUS\n'
print_process_matrix

printf '\nSNAPSHOT\n'
printf '  %s\n' "$STATE_FILE"
