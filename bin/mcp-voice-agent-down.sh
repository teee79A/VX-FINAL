#!/usr/bin/env bash
set -euo pipefail

pkill -f "mcp-voice-agent.py" 2>/dev/null || true
rm -f /home/t79/KITTY/state/mcp/mcp-voice-agent.pid
echo "mcp-voice-agent stopped"
