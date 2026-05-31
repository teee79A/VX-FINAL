#!/usr/bin/env bash
set -euo pipefail

/home/t79/KITTY/bin/mcp-voice-agent-down.sh || true
/home/t79/KITTY/bin/mcp-time-calendar-down.sh || true
/home/t79/KITTY/bin/mcp-linux-admin-down.sh || true
/home/t79/KITTY/bin/agentgateway-down.sh || true

echo "kitty stack stopped"
