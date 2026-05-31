#!/usr/bin/env bash
set -euo pipefail

ROOM_ROOT="/home/t79/KITTY/COMMERCIAL_ROOM"
KITTY_ROOT="/home/t79/KITTY"
NPM_GLOBAL_BIN="${NPM_GLOBAL_BIN:-$HOME/.npm-global/bin}"

print_header() {
  local title="${1:-COMMERCIAL_ROOM}"
  printf '%s\n' "$title"
  printf 'updated: %s\n' "$(date '+%F %T %Z')"
  printf 'room:    %s\n' "$ROOM_ROOT"
  printf '\n'
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

list_room_sections() {
  local sections=(
    "live_control_surface"
    "runtime_status"
    "operator_actions"
    "execution_monitoring"
    "evidence_linked_room_state"
  )
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
  printf '%s\n' "---------------------------------------------------------------"
  check_cmd "beancount" "bean-check" "/home/t79/.local/bin/bean-check"
  check_cmd "fava" "fava" "/home/t79/.local/bin/fava"
  check_cmd "n8n" "n8n" "$NPM_GLOBAL_BIN/n8n"
  check_cmd "hookdeck" "hookdeck" "$NPM_GLOBAL_BIN/hookdeck"
  check_cmd "temporal" "temporal" "/home/t79/.local/bin/temporal"
  check_cmd "airflow" "airflow" "/home/t79/.local/bin/airflow"
  check_cmd "kafka-topics" "kafka-topics" "/home/t79/.local/bin/kafka-topics"
  check_cmd "boundary" "boundary" "/home/t79/.local/bin/boundary"
  check_cmd "consul" "consul" "/home/t79/.local/bin/consul"
  check_cmd "mcp" "mcp" "/home/t79/.local/bin/mcp"
  check_cmd "docker" "docker" "/usr/bin/docker"
}

print_endpoint_matrix() {
  printf '%-20s | %-4s | %s\n' "service" "state" "endpoint"
  printf '%s\n' "-------------------------------------------------------------------"
  check_http "agentgateway" "http://127.0.0.1:46080/health"
  check_http "netdata" "http://127.0.0.1:19999/api/v1/info"
  check_http "clickhouse" "http://127.0.0.1:8123/ping"
  check_http "qdrant" "http://127.0.0.1:6333/collections"
  check_http "consul" "http://127.0.0.1:8500/v1/status/leader"
  check_http "airflow" "http://127.0.0.1:8080/health"
  check_http "n8n" "http://127.0.0.1:5678/healthz"
}

print_process_matrix() {
  printf '%-22s | %-8s | %s\n' "pattern" "state" "match"
  printf '%s\n' "--------------------------------------------------------------------------------"
  local patterns=("n8n" "temporal" "airflow" "kafka.Kafka" "qdrant" "consul" "boundary")
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
