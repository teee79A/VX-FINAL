#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "MEDIA — AUDIO ENGINE" 48

tv_section "AUDIO TOOLS"
for cmd in sox arecord aplay pw-record pw-play ffplay pactl; do
  if command -v "$cmd" >/dev/null 2>&1; then
    tv_row "$cmd" "green" "$(command -v "$cmd")"
  else
    tv_row "$cmd" "red" "not installed"
  fi
done

tv_section "PIPEWIRE STATUS"
if pgrep -f pipewire >/dev/null 2>&1; then
  tv_row "PipeWire" "green" "audio server active"
  # Show sinks
  if command -v pactl >/dev/null 2>&1; then
    printf "\n ${C_GRAY}Active Sinks:${C_RESET}\n"
    pactl list short sinks 2>/dev/null | while read -r idx name driver fmt state; do
      if [[ "$state" == "RUNNING" ]]; then
        tv_row "  $name" "green" "$state"
      else
        tv_row "  $name" "yellow" "$state"
      fi
    done
  fi
else
  tv_row "PipeWire" "red" "not running"
fi

tv_section "AUDIO DEVICES"
printf " ${C_GRAY}Capture:${C_RESET}\n"
arecord -l 2>/dev/null | grep -E '^card' | while read -r line; do
  printf "   ${C_DIM}%s${C_RESET}\n" "$line"
done || printf "   ${C_DIM}none${C_RESET}\n"
