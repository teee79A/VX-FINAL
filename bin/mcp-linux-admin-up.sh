#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="/home/t79/KITTY/state/mcp"
PID_FILE="$STATE_DIR/mcp-linux-admin.pid"
LOG_FILE="$STATE_DIR/mcp-linux-admin.log"
SCRIPT_PATH="/home/t79/KITTY/bin/mcp-linux-admin.py"
HEALTH_URL="http://127.0.0.1:8877/health"

mkdir -p "$STATE_DIR"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null && curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "mcp-linux-admin already running"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if pgrep -fa "$SCRIPT_PATH" >/dev/null 2>&1 && curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
  echo "mcp-linux-admin already running"
  exit 0
fi

setsid -f /usr/bin/python3 "$SCRIPT_PATH" >>"$LOG_FILE" 2>&1
sleep 1

PID="$(pgrep -fo "$SCRIPT_PATH" || true)"
if [[ -n "${PID:-}" ]]; then
  echo "$PID" > "$PID_FILE"
fi

curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null
echo "mcp-linux-admin started"
