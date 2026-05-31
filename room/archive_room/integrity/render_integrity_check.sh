#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

ensure_runtime
status="$(integrity_check)"
write_audit "integrity.checked" "$status"

print_header "ARCHIVING_ROOM / INTEGRITY CHECK"
printf 'baseline_file: %s\n' "$BASELINE_FILE"
printf 'status:        %s\n' "$status"

if [[ "$status" == "FAIL" ]]; then
  printf '\nDIFF PREVIEW\n'
  current_file="$(mktemp)"
  hash_frozen_records > "$current_file"
  diff -u "$BASELINE_FILE" "$current_file" | sed -n '1,120p' || true
  rm -f "$current_file"
fi
