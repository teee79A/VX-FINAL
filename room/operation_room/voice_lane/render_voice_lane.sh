#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

VOICE_DIR="/home/t79/KITTY/evidence/voice_outputs"

tv_header "VOICE LANE — MCP VOICE" 48

tv_section "VOICE SERVICE"
tv_probe "MCP Voice Agent" "http://127.0.0.1:8790/health"

# Get health details
health=$(curl -fsS --max-time 2 http://127.0.0.1:8790/health 2>/dev/null || true)
if [[ -n "$health" ]] && command -v jq >/dev/null 2>&1; then
  status=$(echo "$health" | jq -r '.status // "unknown"')
  tv_row "Status" "$status" "$(echo "$health" | jq -r '.model // "n/a"' 2>/dev/null)"
fi

tv_section "VOICE REGISTRY"
reg="$VOICE_DIR/voice_registry.json"
if [[ -f "$reg" ]]; then
  count=$(jq 'length' "$reg" 2>/dev/null || echo 0)
  tv_metric "Registered voices" "$count"
  jq -r 'keys[]' "$reg" 2>/dev/null | head -5 | while read -r k; do
    printf "   ${C_DIM}• %s${C_RESET}\n" "$k"
  done
else
  printf " ${C_DIM}no voice registry${C_RESET}\n"
fi

tv_section "RECENT VOICE FILES"
if [[ -d "$VOICE_DIR" ]]; then
  find "$VOICE_DIR" -maxdepth 2 -type f -name '*.wav' -o -name '*.mp3' -o -name '*.ogg' 2>/dev/null | \
    xargs -r ls -lt 2>/dev/null | head -8 | awk '{printf "  \033[2m%s %s  %s  %s\033[0m\n", $6, $7, $5, $NF}'
  total=$(find "$VOICE_DIR" -type f 2>/dev/null | wc -l)
  printf "\n ${C_DIM}total files: %s${C_RESET}\n" "$total"
else
  printf " ${C_DIM}voice output dir missing${C_RESET}\n"
fi
