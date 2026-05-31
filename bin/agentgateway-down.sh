#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/home/t79/KITTY/state/agentgateway/gateway.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

pkill -f "agentgateway.py" 2>/dev/null || true
echo "agentgateway stopped"
