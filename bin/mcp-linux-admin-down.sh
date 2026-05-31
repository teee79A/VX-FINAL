#!/usr/bin/env bash
set -euo pipefail

pkill -f "mcp-linux-admin.py" 2>/dev/null || true
rm -f /home/t79/KITTY/state/mcp/mcp-linux-admin.pid
echo "mcp-linux-admin stopped"
