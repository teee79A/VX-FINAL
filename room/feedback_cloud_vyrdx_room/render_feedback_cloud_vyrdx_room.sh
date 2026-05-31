#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "VYRDX CLOUD — FEEDBACK ROOM" 52

tv_section "CLOUD STATUS"
tv_probe "vyrdx.vyrdon.com" "https://vyrdx.vyrdon.com/api/build"
tv_probe "consolab.vyrdon.com" "https://consolab.vyrdon.com/health"

# Get build info
build=$(curl -fsS --max-time 3 "https://vyrdx.vyrdon.com/api/build" 2>/dev/null || true)
if [[ -n "$build" ]] && command -v jq >/dev/null 2>&1; then
  tv_section "VYRDX BUILD"
  tv_metric "Release" "$(echo "$build" | jq -r '.release // "?"')"
  tv_metric "Commit" "$(echo "$build" | jq -r '.commit // "?"')"
  tv_metric "Uptime" "$(echo "$build" | jq -r '.uptime // "?"')"
fi

tv_section "ROOM MODULES"
for mod in cloud_feedback_intake feedback_processing signal_aggregation ai_service_response_layer vyrdx_facing_feedback_outputs; do
  dir="/home/t79/KITTY/FEEDBACK_CLOUD_VYRDX_ROOM/$mod"
  if [[ -d "$dir" ]]; then
    tv_row "$mod" "green"
  else
    tv_row "$mod" "red" "missing"
  fi
done

tv_section "FEEDBACK SNAPSHOTS"
SNAP_DIR="/home/t79/KITTY/FEEDBACK_CLOUD_VYRDX_ROOM"
for f in "$SNAP_DIR"/*/live_*.json; do
  [[ -f "$f" ]] || continue
  name=$(basename "$(dirname "$f")")
  ts=$(jq -r '.timestamp // .updated // "?"' "$f" 2>/dev/null | head -1)
  tv_row "$name" "green" "$ts"
done 2>/dev/null || printf " ${C_DIM}no snapshots${C_RESET}\n"
