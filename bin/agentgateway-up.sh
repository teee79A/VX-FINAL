#!/usr/bin/env bash
set -euo pipefail

POLICY="/home/t79/KITTY/infra/szh_central_brain/gateways/agentgateway.policy.json"
GATEWAY_BIN="/home/t79/KITTY/bin/agentgateway.py"
STATE_DIR="/home/t79/KITTY/state/agentgateway"
PID_FILE="$STATE_DIR/gateway.pid"
LOG_FILE="$STATE_DIR/gateway.stdout.log"
TOKEN_FILE="$STATE_DIR/gateway.token"
RESTART="${1:-}"

mkdir -p "$STATE_DIR"

if [[ ! -f "$TOKEN_FILE" || ! -s "$TOKEN_FILE" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32 > "$TOKEN_FILE"
  else
    python3 - <<'PY' > "$TOKEN_FILE"
import secrets
print(secrets.token_hex(32))
PY
  fi
  chmod 600 "$TOKEN_FILE"
fi

if [[ "$RESTART" == "--restart" ]]; then
  /home/t79/KITTY/bin/agentgateway-down.sh || true
fi

if pgrep -fa "agentgateway.py --policy $POLICY" >/dev/null 2>&1; then
  echo "agentgateway already running"
  exit 0
fi

setsid -f /usr/bin/python3 "$GATEWAY_BIN" --policy "$POLICY" >>"$LOG_FILE" 2>&1
sleep 1

PID="$(pgrep -fo "agentgateway.py --policy $POLICY" || true)"
if [[ -n "${PID:-}" ]]; then
  echo "$PID" > "$PID_FILE"
fi

if curl -fsS --max-time 2 http://127.0.0.1:46080/health >/dev/null 2>&1; then
  echo "agentgateway started"
else
  echo "agentgateway failed to start" >&2
  exit 1
fi
