#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/szh_central_brain/execution_monitoring/render_execution_monitoring.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 4
done
