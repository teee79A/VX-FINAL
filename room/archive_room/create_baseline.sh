#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

ensure_runtime
hash_frozen_records > "$BASELINE_FILE"

timestamp="$(date '+%Y%m%d_%H%M%S')"
copy_file="$ROOM_ROOT/baselines/baseline_${timestamp}.sha256"
cp -f "$BASELINE_FILE" "$copy_file"

log="$ROOM_ROOT/change_history/baseline_${timestamp}.log"
{
  printf 'timestamp=%s\n' "$(date -u '+%FT%TZ')"
  printf 'action=create_baseline\n'
  printf 'baseline=%s\n' "$copy_file"
  printf 'entries=%s\n' "$(wc -l < "$copy_file" | tr -d ' ')"
} > "$log"

write_audit "baseline.created" "$copy_file"
echo "baseline: $copy_file"
