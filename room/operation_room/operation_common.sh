#!/usr/bin/env bash
set -euo pipefail

ROOM_ROOT="/home/t79/KITTY/OPERATION_ROOM"
LEGACY_OPS_ROOT="/home/t79/KITTY/OPERATION_ROOM"
KITTY_ROOT="/home/t79/KITTY"
OPS_STATUS_FILE="$LEGACY_OPS_ROOT/monitoring/latest_status.json"
COMMAND_AUDIT_FILE="$KITTY_ROOT/evidence/journal/command_bus.audit.jsonl"
MODULE_JOURNAL_FILE="$KITTY_ROOT/evidence/journal/module_actions.jsonl"
ROOM_AUDIT_FILE="$KITTY_ROOT/evidence/journal/operation_room.audit.jsonl"

print_header() {
  local title="${1:-OPERATION_ROOM}"
  printf '%s\n' "$title"
  printf 'updated: %s\n' "$(date '+%F %T %Z')"
  printf 'room:    %s\n' "$ROOM_ROOT"
  printf '\n'
}

ensure_runtime() {
  mkdir -p "$ROOM_ROOT/runtime/state" "$ROOM_ROOT/runtime/logs" "$ROOM_ROOT/evidence_linked_room_state/snapshots"
  mkdir -p "$(dirname "$ROOM_AUDIT_FILE")"
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

write_audit() {
  local event="$1"
  local details="$2"
  ensure_runtime
  printf '{"timestamp":"%s","event":"%s","details":"%s"}\n' \
    "$(date -u '+%FT%TZ')" "$event" "$details" >> "$ROOM_AUDIT_FILE"
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

ops_overall_status() {
  if [[ -f "$OPS_STATUS_FILE" ]]; then
    jq -r '.overall_status // "unknown"' "$OPS_STATUS_FILE" 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

ops_missing_count() {
  if [[ -f "$OPS_STATUS_FILE" ]]; then
    jq -r '.missing_count // 0' "$OPS_STATUS_FILE" 2>/dev/null || echo "0"
  else
    echo "0"
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
      printf '%-28s | ready\n' "$section"
    else
      printf '%-28s | missing\n' "$section"
    fi
  done
}

print_engine_matrix() {
  printf '%-20s | %-7s | %s\n' "engine" "state" "binary"
  printf '%s\n' "--------------------------------------------------------------------"
  check_cmd "n8n" "n8n" "/home/t79/.local/bin/n8n"
  check_cmd "temporal" "temporal" "/home/t79/.local/bin/temporal"
  check_cmd "airflow" "airflow" "/home/t79/.local/bin/airflow"
  check_cmd "octosql" "octosql" "/home/t79/.local/bin/octosql"
  check_cmd "steampipe" "steampipe" "/home/t79/.local/bin/steampipe"
  check_cmd "radar" "radar" "/home/t79/.local/bin/radar"
  check_cmd "tenderly" "tenderly" "/home/t79/.local/bin/tenderly"
  check_cmd "calcure" "calcure" "/home/t79/.local/bin/calcure"
  check_cmd "btop" "btop" "/home/t79/.local/bin/btop"
  check_cmd "ffmpeg" "ffmpeg" "/usr/bin/ffmpeg"
  check_cmd "ffplay" "ffplay" "/usr/bin/ffplay"
  check_cmd "mpv" "mpv" "/usr/bin/mpv"
  check_cmd "timg" "timg" "/usr/bin/timg"
  check_cmd "sox" "sox" "/usr/bin/sox"
  check_cmd "pw-play" "pw-play" "/usr/bin/pw-play"
  check_cmd "pw-record" "pw-record" "/usr/bin/pw-record"
  check_cmd "mcp" "mcp" "/home/t79/.local/bin/mcp"
}

print_endpoint_matrix() {
  printf '%-20s | %-4s | %s\n' "service" "state" "endpoint"
  printf '%s\n' "--------------------------------------------------------------------"
  check_http "agentgateway" "http://127.0.0.1:46080/health"
  check_http "netdata" "http://127.0.0.1:19999/api/v1/info"
  check_http "clickhouse" "http://127.0.0.1:8123/ping"
  check_http "n8n" "http://127.0.0.1:5678/healthz"
  check_http "airflow" "http://127.0.0.1:8080/health"
  check_http "mcp-voice" "http://127.0.0.1:8790/health"
  check_http "mcp-time-cal" "http://127.0.0.1:8792/health"
}

print_process_matrix() {
  printf '%-22s | %-8s | %s\n' "pattern" "state" "match"
  printf '%s\n' "--------------------------------------------------------------------------------"
  local patterns=("n8n" "temporal" "airflow" "radar" "steampipe" "octosql" "agentgateway.py" "mcp-time-calendar-agent.py" "mcp-voice-agent.py" "pipewire")
  local pattern
  for pattern in "${patterns[@]}"; do
    local match
    match="$(pgrep -fa "$pattern" | head -n 1 || true)"
    if [[ -n "$match" ]]; then
      printf '%-22s | %-8s | %s\n' "$pattern" "running" "$match"
    else
      printf '%-22s | %-8s | %s\n' "$pattern" "stopped" "-"
    fi
  done
}
