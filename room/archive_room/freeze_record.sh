#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <source_file>" >&2
  exit 1
fi

src="$1"
if [[ ! -f "$src" ]]; then
  echo "source file not found: $src" >&2
  exit 1
fi

ensure_runtime
timestamp="$(date '+%Y%m%d_%H%M%S')"
base="$(basename "$src")"
dest="$ROOM_ROOT/frozen_records/${timestamp}_${base}"
cp -f "$src" "$dest"

log="$ROOM_ROOT/change_history/freeze_${timestamp}.log"
{
  printf 'timestamp=%s\n' "$(date -u '+%FT%TZ')"
  printf 'action=freeze_record\n'
  printf 'source=%s\n' "$src"
  printf 'dest=%s\n' "$dest"
  sha256sum "$dest"
} > "$log"

write_audit "record.frozen" "$dest"
echo "frozen: $dest"
