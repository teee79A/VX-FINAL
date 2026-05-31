#!/usr/bin/env bash
set -euo pipefail

echo "MCP VOICE STATUS"
pgrep -fa "mcp-voice-agent.py" || true
echo
curl -fsS --max-time 2 http://127.0.0.1:8790/health || echo "down"
