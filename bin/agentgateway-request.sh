#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <command_id> [params_json] [caller]"
  exit 1
fi

COMMAND_ID="$1"
PARAMS_JSON="${2:-{}}"
CALLER="${3:-OperatorLocal}"
TOKEN_FILE="/home/t79/KITTY/state/agentgateway/gateway.token"

if [[ ! -s "$TOKEN_FILE" ]]; then
  echo "missing token file: $TOKEN_FILE" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  PARAMS_COMPACT="$(jq -c . <<<"$PARAMS_JSON" 2>/dev/null || true)"
  if [[ -z "$PARAMS_COMPACT" ]]; then
    echo "invalid params_json: $PARAMS_JSON" >&2
    exit 1
  fi
else
  PARAMS_COMPACT="$PARAMS_JSON"
fi

BODY="{\"command\":\"$COMMAND_ID\",\"params\":$PARAMS_COMPACT}"
TOKEN="$(cat "$TOKEN_FILE")"

RESP="$(curl -fsS --max-time 30 \
  http://127.0.0.1:46080/v1/control/dispatch \
  -H "content-type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-VXSTATION-Caller: $CALLER" \
  -d "$BODY")"

if command -v jq >/dev/null 2>&1; then
  echo "$RESP" | jq .
else
  echo "$RESP"
fi
