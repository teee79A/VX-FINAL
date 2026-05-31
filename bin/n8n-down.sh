#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/home/t79/KITTY/state/n8n/n8n.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

pkill -f '/home/t79/.local/bin/n8n start --host 127.0.0.1 --port 5678' 2>/dev/null || true
echo "n8n stopped"
