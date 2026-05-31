#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/calendar/render_calendar_status.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 8
done
