#!/usr/bin/env bash
set -euo pipefail

ROOM_ROOT="/home/t79/KITTY/COMMERCIAL_ROOM"
PANEL_ROOT="/home/t79/KITTY/room/commercial_room"

printf 'COMMERCIAL ROOM REPORT\n'
printf 'generated: %s\n\n' "$(date '+%F %T %Z')"

printf 'ROOM ROOT\n'
printf '  %s\n\n' "$ROOM_ROOT"

printf 'ENGINE REGISTRY\n'
if command -v column >/dev/null 2>&1; then
  column -t -s $'\t' "$ROOM_ROOT/engine_registry.tsv"
else
  cat "$ROOM_ROOT/engine_registry.tsv"
fi

printf '\nCONNECTOR REGISTRY\n'
if command -v column >/dev/null 2>&1; then
  column -t -s $'\t' "$ROOM_ROOT/connector_registry.tsv"
else
  cat "$ROOM_ROOT/connector_registry.tsv"
fi

printf '\nSERVER REGISTRY\n'
if command -v column >/dev/null 2>&1; then
  column -t -s $'\t' "$ROOM_ROOT/server_registry.tsv"
else
  cat "$ROOM_ROOT/server_registry.tsv"
fi

printf '\nLIVE STATUS SNAPSHOT\n'
bash "$PANEL_ROOT/runtime_status/render_runtime_status.sh"
