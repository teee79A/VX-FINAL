#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/VYRDOX_HIDDEN_ROOT"
while true; do
  clear
  printf 'VYRDOX HIDDEN ROOT\n'
  printf 'updated: %s\n\n' "$(date '+%F %T %Z')"
  if [[ -d "$ROOT" ]]; then
    find "$ROOT" -maxdepth 2 -type d | sort
  else
    echo "missing root: $ROOT"
  fi
  sleep 7
done
