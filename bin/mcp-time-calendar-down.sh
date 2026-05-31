#!/usr/bin/env bash
set -euo pipefail

pkill -f "mcp-time-calendar-agent.py" 2>/dev/null || true
rm -f /home/t79/KITTY/state/mcp/mcp-time-calendar.pid
echo "mcp-time-calendar stopped"
