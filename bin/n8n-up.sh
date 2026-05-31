#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="/home/t79/KITTY/state/n8n"
PID_FILE="$STATE_DIR/n8n.pid"
LOG_FILE="$STATE_DIR/n8n.log"
BIN="/home/t79/.local/bin/n8n"
HEALTH_URL="http://127.0.0.1:5678/healthz"

mkdir -p "$STATE_DIR"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null && curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "n8n already running"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if pgrep -fa "$BIN start --host 127.0.0.1 --port 5678" >/dev/null 2>&1 && curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
  echo "n8n already running"
  exit 0
fi

setsid -f "$BIN" start --host 127.0.0.1 --port 5678 >>"$LOG_FILE" 2>&1
PID="$(pgrep -fo "$BIN start --host 127.0.0.1 --port 5678" || true)"
if [[ -n "${PID:-}" ]]; then
  echo "$PID" > "$PID_FILE"
fi

for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "n8n started"
    exit 0
  fi
  sleep 1
done

tail -n 40 "$LOG_FILE" >&2 || true
exit 1
