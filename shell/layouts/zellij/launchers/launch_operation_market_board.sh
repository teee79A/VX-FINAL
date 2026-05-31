#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/market_board/render_market_board.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 8
done
