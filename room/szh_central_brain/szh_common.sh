#!/usr/bin/env bash
set -euo pipefail

ROOM_ROOT="/home/t79/KITTY/SZH_CENTRAL_BRAIN"
KITTY_ROOT="/home/t79/KITTY"
ROOM_AUDIT_FILE="$KITTY_ROOT/evidence/journal/szh_central_brain.audit.jsonl"
COMMAND_AUDIT_FILE="$KITTY_ROOT/evidence/journal/command_bus.audit.jsonl"
MODULE_JOURNAL_FILE="$KITTY_ROOT/evidence/journal/module_actions.jsonl"

ENGINE_CATALOG_FILE="$KITTY_ROOT/data/szh_central_brain/engine_catalog.json"
NERVES_FILE="$KITTY_ROOT/data/szh_central_brain/mcp_nervous_system.json"
BRIDGE_NODES_FILE="$KITTY_ROOT/bridge/nodes.json"
TOPOLOGY_FILE="$KITTY_ROOT/bridge/topology.manifest.json"
GATEWAY_MANIFEST_FILE="$KITTY_ROOT/infra/szh_central_brain/gateway_control.manifest.json"
COMMAND_REGISTRY_FILE="$KITTY_ROOT/infra/szh_central_brain/gateways/agentgateway.command_registry.json"
CONTROL_PLANE_FILE="$KITTY_ROOT/infra/vxstation_control/control_plane.manifest.json"

print_header() {
  local title="${1:-SZH_CENTRAL_BRAIN}"
  printf '%s\n' "$title"
  printf 'updated: %s\n' "$(date '+%F %T %Z')"
  printf 'room:    %s\n' "$ROOM_ROOT"
  printf '\n'
}

ensure_runtime() {
  mkdir -p "$ROOM_ROOT/runtime/state" "$ROOM_ROOT/runtime/logs" "$ROOM_ROOT/evidence_linked_room_state/snapshots"
  mkdir -p "$(dirname "$ROOM_AUDIT_FILE")"
}

write_audit() {
  local event="$1"
  local details="$2"
  ensure_runtime
  printf '{"timestamp":"%s","event":"%s","details":"%s"}\n' \
    "$(date -u '+%FT%TZ')" "$event" "$details" >> "$ROOM_AUDIT_FILE"
}

print_tsv() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf 'missing file: %s\n' "$file"
    return 0
  fi
  if command -v column >/dev/null 2>&1; then
    column -t -s $'\t' "$file"
  else
    cat "$file"
  fi
}

json_value() {
  local file="$1"
  local filter="$2"
  local fallback="${3:--}"
  if [[ ! -f "$file" ]]; then
    printf '%s' "$fallback"
    return 0
  fi
  if ! command -v jq >/dev/null 2>&1; then
    printf '%s' "$fallback"
    return 0
  fi
  local value
  value="$(jq -r "$filter // empty" "$file" 2>/dev/null || true)"
  if [[ -z "$value" || "$value" == "null" ]]; then
    printf '%s' "$fallback"
    return 0
  fi
  printf '%s' "$value"
}

check_cmd() {
  local label="$1"
  local cmd="$2"
  local fallback="${3:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%-22s | %-7s | %s\n' "$label" "online" "$(command -v "$cmd")"
    return 0
  fi
  if [[ -n "$fallback" && -x "$fallback" ]]; then
    printf '%-22s | %-7s | %s\n' "$label" "online" "$fallback"
    return 0
  fi
  printf '%-22s | %-7s | %s\n' "$label" "missing" "-"
}

check_http() {
  local label="$1"
  local url="$2"
  if curl -fsS --max-time 1 "$url" >/dev/null 2>&1; then
    printf '%-22s | %-4s | %s\n' "$label" "up" "$url"
  else
    printf '%-22s | %-4s | %s\n' "$label" "down" "$url"
  fi
}

check_file() {
  local label="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    printf '%-22s | %-6s | %s\n' "$label" "ready" "$file"
  else
    printf '%-22s | %-6s | %s\n' "$label" "missing" "$file"
  fi
}

list_sections() {
  local sections=(
    "live_control_surface"
    "runtime_status"
    "operator_actions"
    "execution_monitoring"
    "evidence_linked_room_state"
  )
  local section
  for section in "${sections[@]}"; do
    if [[ -d "$ROOM_ROOT/$section" ]]; then
      printf '%-30s | ready\n' "$section"
    else
      printf '%-30s | missing\n' "$section"
    fi
  done
}

list_orchestration_domains() {
  local domains=(
    "orchestration_logic"
    "policy_routing"
    "state_synthesis"
    "cross_room_coordination"
    "decision_support"
  )
  local domain
  for domain in "${domains[@]}"; do
    if [[ -d "$ROOM_ROOT/$domain" ]]; then
      printf '%-30s | ready\n' "$domain"
    else
      printf '%-30s | missing\n' "$domain"
    fi
  done
}

print_engine_matrix() {
  printf '%-24s | %-9s | %s\n' "engine_id" "state" "connector"
  printf '%s\n' "--------------------------------------------------------------------------------"
  if [[ -f "$ENGINE_CATALOG_FILE" ]] && command -v jq >/dev/null 2>&1; then
    jq -r '.engines[]? | "\(.engine_id)\t\(.observed_state // "unknown")\t\(.integration.connector_id // "-")"' "$ENGINE_CATALOG_FILE" \
      | while IFS=$'\t' read -r engine_id state connector; do
          printf '%-24s | %-9s | %s\n' "$engine_id" "$state" "$connector"
        done
    return 0
  fi
  if [[ -f "$ROOM_ROOT/engine_registry.tsv" ]]; then
    print_tsv "$ROOM_ROOT/engine_registry.tsv"
  else
    echo "engine catalog missing"
  fi
}

print_endpoint_matrix() {
  printf '%-22s | %-4s | %s\n' "service" "up?" "endpoint"
  printf '%s\n' "--------------------------------------------------------------------------------"
  check_http "agentgateway" "http://127.0.0.1:46080/health"
  check_http "mcp-linux-admin" "http://127.0.0.1:8877/health"
  check_http "mcp-time-calendar" "http://127.0.0.1:8792/health"
  check_http "mcp-voice-agent" "http://127.0.0.1:8790/health"
  check_http "netdata" "http://127.0.0.1:19999/api/v1/info"
  check_http "clickhouse" "http://127.0.0.1:8123/ping"
}

print_process_matrix() {
  printf '%-24s | %-8s | %s\n' "pattern" "state" "match"
  printf '%s\n' "--------------------------------------------------------------------------------"
  local patterns=(
    "agentgateway.py"
    "mcp-linux-admin.py"
    "mcp-time-calendar-agent.py"
    "mcp-voice-agent.py"
    "n8n"
    "airflow"
    "kafka.Kafka"
    "qdrant"
  )
  local pattern
  for pattern in "${patterns[@]}"; do
    local match
    match="$(pgrep -fa "$pattern" | head -n 1 || true)"
    if [[ -n "$match" ]]; then
      printf '%-24s | %-8s | %s\n' "$pattern" "running" "$match"
    else
      printf '%-24s | %-8s | %s\n' "$pattern" "stopped" "-"
    fi
  done
}

print_manifest_matrix() {
  printf '%-22s | %-6s | %s\n' "artifact" "state" "path"
  printf '%s\n' "--------------------------------------------------------------------------------"
  check_file "gateway_manifest" "$GATEWAY_MANIFEST_FILE"
  check_file "command_registry" "$COMMAND_REGISTRY_FILE"
  check_file "control_plane" "$CONTROL_PLANE_FILE"
  check_file "bridge_nodes" "$BRIDGE_NODES_FILE"
  check_file "bridge_topology" "$TOPOLOGY_FILE"
  check_file "nervous_system" "$NERVES_FILE"
}

print_gateway_guardrail() {
  printf '%-22s | %s\n' "route_target" "$(json_value "$CONTROL_PLANE_FILE" '.route_target' '-')"
  printf '%-22s | %s\n' "authority" "$(json_value "$CONTROL_PLANE_FILE" '.authority' '-')"
  printf '%-22s | %s\n' "bind_host" "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.bind_host' '-')"
  printf '%-22s | %s\n' "bind_port" "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.bind_port' '-')"
  printf '%-22s | %s\n' "loopback_only" "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.loopback_only' '-')"
  printf '%-22s | %s\n' "token_required" "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.bearer_token_required' '-')"
  printf '%-22s | %s\n' "caller_required" "$(json_value "$GATEWAY_MANIFEST_FILE" '.runtime.caller_header_required' '-')"
}

print_station_map_excerpt() {
  local map_script="/home/t79/KITTY/bin/station-map.py"
  if [[ -x "$map_script" ]]; then
    python3 "$map_script" --pretty 2>/dev/null | sed -n '1,100p'
  else
    printf 'missing executable: %s\n' "$map_script"
  fi
}
