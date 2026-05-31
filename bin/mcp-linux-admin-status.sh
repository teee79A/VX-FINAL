#!/usr/bin/env bash
set -euo pipefail

echo "MCP LINUX ADMIN STATUS"
pgrep -fa "mcp-linux-admin.py" || true
echo
curl -fsS --max-time 2 http://127.0.0.1:8877/health || echo "down"
