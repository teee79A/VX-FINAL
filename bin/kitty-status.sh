#!/usr/bin/env bash
set -euo pipefail

/home/t79/KITTY/bin/agentgateway-status.sh
echo
/home/t79/KITTY/bin/mcp-linux-admin-status.sh
echo
/home/t79/KITTY/bin/mcp-time-calendar-status.sh
echo
/home/t79/KITTY/bin/mcp-voice-agent-status.sh
echo
python3 /home/t79/KITTY/bin/station-map.py --pretty
