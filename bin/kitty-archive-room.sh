#!/usr/bin/env bash
set -euo pipefail

source /home/t79/KITTY/bin/kitty-launch-lib.sh

LAYOUT="/home/t79/KITTY/shell/layouts/zellij/archive_room.kdl"
SESSION="vxstation-archive-room"
RESET="${1:-}"

if [[ "$RESET" == "--reset" ]]; then
  zellij delete-session "$SESSION" >/dev/null 2>&1 || true
fi

if [[ ! -f "$LAYOUT" ]]; then
  echo "missing layout: $LAYOUT" >&2
  exit 1
fi

launch_terminal_layout "$SESSION" "$LAYOUT" "VXSTATION ARCHIVING ROOM"
