#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/szh_central_brain/live_control_surface/render_live_control_surface.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 5
done
