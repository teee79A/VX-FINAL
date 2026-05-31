#!/usr/bin/env bash
set -euo pipefail

echo "MCP TIME CALENDAR STATUS"
pgrep -fa "mcp-time-calendar-agent.py" || true
echo
curl -fsS --max-time 2 http://127.0.0.1:8792/health || echo "down"
