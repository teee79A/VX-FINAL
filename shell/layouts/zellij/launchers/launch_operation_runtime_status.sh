#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/runtime_status/render_runtime_status.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 5
done
