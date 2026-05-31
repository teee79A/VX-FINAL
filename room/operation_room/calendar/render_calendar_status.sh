#!/usr/bin/env bash
set -euo pipefail

printf 'OPERATION_ROOM / CALENDAR STATUS\n'
printf 'updated: %s\n\n' "$(date '+%F %T %Z')"

printf 'current_date: %s\n' "$(date '+%A, %Y-%m-%d')"
printf 'current_time: %s\n' "$(date '+%H:%M:%S %Z')"

if command -v calcure >/dev/null 2>&1; then
  printf '\ncalcure: online (%s)\n' "$(command -v calcure)"
else
  printf '\ncalcure: missing\n'
fi
