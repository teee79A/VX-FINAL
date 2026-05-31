#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

ensure_runtime
status="$(integrity_check)"
timestamp="$(date '+%Y%m%d_%H%M%S')"
log="$ROOM_ROOT/runtime/logs/integrity_${timestamp}.log"

{
  printf 'timestamp=%s\n' "$(date -u '+%FT%TZ')"
  printf 'status=%s\n' "$status"
  printf 'baseline=%s\n' "$BASELINE_FILE"
} > "$log"

write_audit "integrity.verified" "$status"
echo "integrity: $status"
echo "log: $log"

if [[ "$status" == "FAIL" ]]; then
  exit 2
fi
