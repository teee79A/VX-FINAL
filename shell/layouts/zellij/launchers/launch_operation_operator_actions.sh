#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/operator_actions/render_operator_actions.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 8
done
