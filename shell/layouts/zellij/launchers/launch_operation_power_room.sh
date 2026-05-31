#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/power_room/render_power_room.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 5
done
