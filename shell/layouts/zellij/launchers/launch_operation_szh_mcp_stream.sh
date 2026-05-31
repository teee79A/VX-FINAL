#!/usr/bin/env bash
set -euo pipefail

SCRIPT="/home/t79/KITTY/room/operation_room/szh_mcp_stream/render_szh_mcp_stream.sh"
while true; do
  clear
  bash "$SCRIPT"
  sleep 4
done
