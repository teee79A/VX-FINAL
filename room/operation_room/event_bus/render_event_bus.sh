#!/usr/bin/env bash
set -euo pipefail

FILE="/home/t79/KITTY/evidence/journal/command_bus.audit.jsonl"

printf 'OPERATION_ROOM / EVENT BUS\n'
printf 'updated: %s\n\n' "$(date '+%F %T %Z')"
printf 'file: %s\n\n' "$FILE"
tail -n 120 "$FILE" 2>/dev/null || echo "no command bus events yet"
