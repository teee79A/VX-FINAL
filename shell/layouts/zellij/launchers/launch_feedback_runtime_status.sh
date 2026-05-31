#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/feedback_cloud_vyrdx_room/runtime_status/render_runtime_status.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 4
done
