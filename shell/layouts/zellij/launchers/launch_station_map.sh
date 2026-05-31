#!/usr/bin/env bash
set -euo pipefail
while true; do
  clear
  date '+%F %T %Z'
  echo
  python3 /home/t79/KITTY/bin/station-map.py --pretty 2>/dev/null || echo "station-map unavailable"
  sleep 2
done
