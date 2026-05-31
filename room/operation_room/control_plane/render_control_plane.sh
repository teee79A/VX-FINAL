#!/usr/bin/env bash
set -euo pipefail

OPS_STATUS_FILE="/home/t79/KITTY/OPERATION_ROOM/monitoring/latest_status.json"
REG_FILE="/home/t79/KITTY/OPERATION_ROOM/registry/component_registry.json"

printf 'OPERATION_ROOM / CONTROL PLANE\n'
printf 'updated: %s\n\n' "$(date '+%F %T %Z')"

if [[ -f "$OPS_STATUS_FILE" ]]; then
  printf 'status_file: %s\n' "$OPS_STATUS_FILE"
  printf 'overall_status: %s\n' "$(jq -r '.overall_status // "unknown"' "$OPS_STATUS_FILE" 2>/dev/null)"
  printf 'missing_count:  %s\n' "$(jq -r '.missing_count // 0' "$OPS_STATUS_FILE" 2>/dev/null)"
else
  printf 'status_file missing: %s\n' "$OPS_STATUS_FILE"
fi

printf '\nregistry_file: %s\n' "$REG_FILE"
if [[ -f "$REG_FILE" ]]; then
  printf 'registry_components: %s\n' "$(jq -r '.components | length' "$REG_FILE" 2>/dev/null || echo 0)"
else
  printf 'registry missing\n'
fi
