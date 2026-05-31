#!/usr/bin/env bash
set -euo pipefail

FILE="/home/t79/KITTY/terminal/ssh/vxstation_terminal_import.ssh.conf"
while true; do
  clear
  printf 'TERMINAL SSH IMPORT VIEW\n'
  printf 'updated: %s\n\n' "$(date '+%F %T %Z')"
  if [[ -f "$FILE" ]]; then
    sed -n '1,200p' "$FILE"
  else
    echo "missing file: $FILE"
  fi
  sleep 6
done
