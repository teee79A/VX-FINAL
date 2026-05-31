#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/control_plane/render_control_plane.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 6
done
