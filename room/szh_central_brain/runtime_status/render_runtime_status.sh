#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/szh_central_brain"
# shellcheck source=/dev/null
source "$ROOT/szh_common.sh"

ensure_runtime
STATE_FILE="$ROOM_ROOT/runtime/state/latest_runtime_status.txt"

bridge_nodes_total="0"
if [[ -f "$BRIDGE_NODES_FILE" ]] && command -v jq >/dev/null 2>&1; then
  bridge_nodes_total="$(jq -r '.nodes | length' "$BRIDGE_NODES_FILE" 2>/dev/null || echo 0)"
fi

command_total="0"
if [[ -f "$COMMAND_REGISTRY_FILE" ]] && command -v jq >/dev/null 2>&1; then
  command_total="$(jq -r '.commands | length' "$COMMAND_REGISTRY_FILE" 2>/dev/null || echo 0)"
fi

{
  printf 'captured_at=%s\n' "$(date -u '+%FT%TZ')"
  printf 'route_target=%s\n' "$(json_value "$CONTROL_PLANE_FILE" '.route_target' '-')"
  printf 'authority=%s\n' "$(json_value "$CONTROL_PLANE_FILE" '.authority' '-')"
  printf 'gateway_bind=%s:%s\n' "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.bind_host' '-')" "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.bind_port' '-')"
  printf 'loopback_only=%s\n' "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.loopback_only' '-')"
  printf 'token_required=%s\n' "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.bearer_token_required' '-')"
  printf 'bridge_nodes_total=%s\n' "$bridge_nodes_total"
  printf 'registered_commands=%s\n' "$command_total"
} > "$STATE_FILE"

write_audit "szh.runtime_snapshot" "$STATE_FILE"

print_header "SZH_CENTRAL_BRAIN / RUNTIME STATUS"

printf 'RUNTIME SNAPSHOT\n'
cat "$STATE_FILE"

printf '\nENGINE STATUS\n'
print_engine_matrix

printf '\nENDPOINT STATUS\n'
print_endpoint_matrix

printf '\nSTATION MAP EXCERPT\n'
print_station_map_excerpt
