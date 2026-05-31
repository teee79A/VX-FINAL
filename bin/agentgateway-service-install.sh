#!/usr/bin/env bash
set -euo pipefail

SRC="/home/t79/KITTY/infra/operation_room/systemd/vxstation-agentgateway.service"
DST_DIR="$HOME/.config/systemd/user"
DST="$DST_DIR/vxstation-agentgateway.service"

mkdir -p "$DST_DIR"
cp "$SRC" "$DST"
systemctl --user daemon-reload
systemctl --user enable --now vxstation-agentgateway.service
systemctl --user status vxstation-agentgateway.service --no-pager --lines=5 || true
