#!/usr/bin/env bash
set -euo pipefail

ROOM_ROOT="/home/t79/KITTY/FEEDBACK_CLOUD_VYRDX_ROOM"
KITTY_ROOT="/home/t79/KITTY"
COMMAND_AUDIT_FILE="$KITTY_ROOT/evidence/journal/command_bus.audit.jsonl"
MODULE_JOURNAL_FILE="$KITTY_ROOT/evidence/journal/module_actions.jsonl"
ROOM_AUDIT_FILE="$KITTY_ROOT/evidence/journal/feedback_cloud_vyrdx_room.audit.jsonl"

print_header() {
  local title="${1:-FEEDBACK_CLOUD_VYRDX_ROOM}"
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

check_cmd() {
  local label="$1"
  local cmd="$2"
  local fallback="${3:-}"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%-20s | %-7s | %s\n' "$label" "online" "$(command -v "$cmd")"
    return 0
  fi
  if [[ -n "$fallback" && -x "$fallback" ]]; then
    printf '%-20s | %-7s | %s\n' "$label" "online" "$fallback"
    return 0
  fi
  printf '%-20s | %-7s | %s\n' "$label" "missing" "-"
}

check_http() {
  local label="$1"
  local url="$2"
  if curl -fsS --max-time 1 "$url" >/dev/null 2>&1; then
    printf '%-20s | %-4s | %s\n' "$label" "up" "$url"
  else
    printf '%-20s | %-4s | %s\n' "$label" "down" "$url"
  fi
}

section_file_count() {
  local section="$1"
  find "$ROOM_ROOT/$section" -type f ! -name '*.md' 2>/dev/null | wc -l | tr -d ' '
}

list_sections() {
  local sections=(
    "cloud_feedback_intake"
    "feedback_processing"
    "signal_aggregation"
    "ai_service_response_layer"
    "vyrdx_facing_feedback_outputs"
  )
  local s
  for s in "${sections[@]}"; do
    printf '%-30s | files=%s\n' "$s" "$(section_file_count "$s")"
  done
}

print_engine_matrix() {
  printf '%-20s | %-7s | %s\n' "engine" "state" "binary"
  printf '%s\n' "--------------------------------------------------------------------"
  check_cmd "hookdeck" "hookdeck" "/home/t79/.local/bin/hookdeck"
  check_cmd "n8n" "n8n" "/home/t79/.local/bin/n8n"
  check_cmd "tenderly" "tenderly" "/home/t79/.local/bin/tenderly"
  check_cmd "radar" "radar" "/home/t79/.local/bin/radar"
  check_cmd "octosql" "octosql" "/home/t79/.local/bin/octosql"
  check_cmd "steampipe" "steampipe" "/home/t79/.local/bin/steampipe"
  check_cmd "mcp" "mcp" "/home/t79/.local/bin/mcp"
}

print_endpoint_matrix() {
  printf '%-20s | %-4s | %s\n' "service" "state" "endpoint"
  printf '%s\n' "--------------------------------------------------------------------"
  check_http "n8n" "http://127.0.0.1:5678/healthz"
  check_http "clickhouse" "http://127.0.0.1:8123/ping"
  check_http "qdrant" "http://127.0.0.1:6333/collections"
  check_http "agentgateway" "http://127.0.0.1:46080/health"
  check_http "netdata" "http://127.0.0.1:19999/api/v1/info"
}

print_process_matrix() {
  printf '%-22s | %-8s | %s\n' "pattern" "state" "match"
  printf '%s\n' "--------------------------------------------------------------------------------"
  local patterns=("n8n" "hookdeck" "tenderly" "radar" "agentgateway.py")
  local p
  for p in "${patterns[@]}"; do
    local match
    match="$(pgrep -fa "$p" | head -n 1 || true)"
    if [[ -n "$match" ]]; then
      printf '%-22s | %-8s | %s\n' "$p" "running" "$match"
    else
      printf '%-22s | %-8s | %s\n' "$p" "stopped" "-"
    fi
  done
}
