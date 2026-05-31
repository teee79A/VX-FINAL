#!/usr/bin/env bash
set -euo pipefail

POLICY="/home/t79/KITTY/infra/szh_central_brain/gateways/agentgateway.policy.json"
REGISTRY="/home/t79/KITTY/infra/szh_central_brain/gateways/agentgateway.command_registry.json"
TOKEN_FILE="/home/t79/KITTY/state/agentgateway/gateway.token"

echo "AGENTGATEWAY STATUS"
echo "policy:   $POLICY"
echo "registry: $REGISTRY"
echo "token:    $TOKEN_FILE"
echo

for file in "$POLICY" "$REGISTRY" "$TOKEN_FILE"; do
  if [[ -f "$file" ]]; then
    echo "ok      $file"
  else
    echo "missing $file"
  fi
done
echo

echo "processes:"
pgrep -fa "agentgateway.py" || true
echo

echo "health:"
curl -fsS --max-time 2 http://127.0.0.1:46080/health || echo "down"
echo

if [[ -s "$TOKEN_FILE" ]]; then
  TOKEN="$(cat "$TOKEN_FILE")"
  echo "policy-check:"
  curl -fsS --max-time 2 \
    http://127.0.0.1:46080/v1/meta/policy \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-VXSTATION-Caller: OperatorLocal" || echo "meta policy unavailable"
  echo
fi
