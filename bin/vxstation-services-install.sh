#!/usr/bin/env bash
set -euo pipefail

USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
mkdir -p "$USER_SYSTEMD_DIR"

cp /home/t79/KITTY/infra/operation_room/systemd/vxstation-agentgateway.service "$USER_SYSTEMD_DIR/"
cp /home/t79/KITTY/infra/operation_room/systemd/vxstation-mcp-linux-admin.service "$USER_SYSTEMD_DIR/"
cp /home/t79/KITTY/infra/operation_room/systemd/vxstation-mcp-time-calendar.service "$USER_SYSTEMD_DIR/"
cp /home/t79/KITTY/infra/operation_room/systemd/vxstation-mcp-voice-agent.service "$USER_SYSTEMD_DIR/"

systemctl --user daemon-reload
systemctl --user enable --now vxstation-agentgateway.service
systemctl --user enable --now vxstation-mcp-linux-admin.service
systemctl --user enable --now vxstation-mcp-time-calendar.service
systemctl --user enable --now vxstation-mcp-voice-agent.service

systemctl --user --no-pager --lines=5 status vxstation-agentgateway.service || true
systemctl --user --no-pager --lines=5 status vxstation-mcp-linux-admin.service || true
systemctl --user --no-pager --lines=5 status vxstation-mcp-time-calendar.service || true
systemctl --user --no-pager --lines=5 status vxstation-mcp-voice-agent.service || true
