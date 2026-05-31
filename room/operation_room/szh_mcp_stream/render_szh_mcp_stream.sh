#!/usr/bin/env bash
set -euo pipefail

COMMAND_AUDIT_FILE="/home/t79/KITTY/evidence/journal/command_bus.audit.jsonl"
MODULE_JOURNAL_FILE="/home/t79/KITTY/evidence/journal/module_actions.jsonl"

printf 'OPERATION_ROOM / SZH MCP STREAM\n'
printf 'updated: %s\n\n' "$(date '+%F %T %Z')"

printf 'command bus stream\n'
tail -n 20 "$COMMAND_AUDIT_FILE" 2>/dev/null || echo "no command bus stream"

printf '\nmodule stream\n'
tail -n 20 "$MODULE_JOURNAL_FILE" 2>/dev/null || echo "no module stream"
