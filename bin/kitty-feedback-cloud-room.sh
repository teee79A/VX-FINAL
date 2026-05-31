#!/usr/bin/env bash
set -euo pipefail

source /home/t79/KITTY/bin/kitty-launch-lib.sh

LAYOUT="/home/t79/KITTY/shell/layouts/zellij/feedback_cloud_vyrdx_room.kdl"
SESSION="vxstation-feedback-cloud-room"
RESET="${1:-}"

if [[ "$RESET" == "--reset" ]]; then
  zellij delete-session "$SESSION" >/dev/null 2>&1 || true
fi

if [[ ! -f "$LAYOUT" ]]; then
  echo "missing layout: $LAYOUT" >&2
  exit 1
fi

launch_terminal_layout "$SESSION" "$LAYOUT" "VXSTATION FEEDBACK CLOUD ROOM"
