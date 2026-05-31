#!/usr/bin/env bash
set -euo pipefail

KITTY_BIN="/home/t79/generic/.local/kitty.app/bin/kitty"
ZELLIJ="/home/t79/generic/.local/bin/zellij"
LAYOUT="/home/t79/KITTY/shell/layouts/zellij/vxstation.kdl"
SESSION="vxstation-tv-wall"

# If session exists, attach to it; otherwise create new
if "$ZELLIJ" list-sessions 2>/dev/null | grep -q "^${SESSION} "; then
  exec "$KITTY_BIN" --title "VXSTATION TV WALL" --start-as fullscreen \
    "$ZELLIJ" attach "$SESSION"
else
  exec "$KITTY_BIN" --title "VXSTATION TV WALL" --start-as fullscreen \
    "$ZELLIJ" --session "$SESSION" --new-session-with-layout "$LAYOUT"
fi
