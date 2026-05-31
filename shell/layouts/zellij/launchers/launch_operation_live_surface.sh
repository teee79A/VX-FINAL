#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/live_surface/render_live_surface.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 5
done
