#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/execution_monitoring/render_execution_monitoring.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 4
done
