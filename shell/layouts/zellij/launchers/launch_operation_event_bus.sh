#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/event_bus/render_event_bus.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 3
done
