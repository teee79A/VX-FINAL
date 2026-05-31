#!/usr/bin/env bash
set -euo pipefail

bash /home/t79/KITTY/bin/mcp-linux-admin-up.sh
bash /home/t79/KITTY/bin/mcp-time-calendar-up.sh
bash /home/t79/KITTY/bin/mcp-voice-agent-up.sh
bash /home/t79/KITTY/bin/agentgateway-up.sh

echo "kitty stack started"
