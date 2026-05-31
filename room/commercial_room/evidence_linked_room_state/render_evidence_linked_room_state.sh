#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/commercial_room"
# shellcheck source=/dev/null
source "$ROOT/commercial_common.sh"

SNAPSHOT_DIR="$ROOM_ROOT/evidence_linked_room_state/snapshots"
SNAPSHOT_FILE="$SNAPSHOT_DIR/latest_snapshot.txt"
mkdir -p "$SNAPSHOT_DIR"

print_header "COMMERCIAL_ROOM / EVIDENCE-LINKED STATE"

{
  printf 'captured_at=%s\n' "$(date -u '+%FT%TZ')"
  printf 'room_root=%s\n' "$ROOM_ROOT"
  printf 'engine_registry=%s\n' "$ROOM_ROOT/engine_registry.tsv"
  printf 'connector_registry=%s\n' "$ROOM_ROOT/connector_registry.tsv"
  printf 'server_registry=%s\n' "$ROOM_ROOT/server_registry.tsv"
  printf '\n[evidence_journal_files]\n'
  find "$KITTY_ROOT/evidence/journal" -maxdepth 2 -type f 2>/dev/null | sort
} > "$SNAPSHOT_FILE"

printf 'ROOM REGISTRIES\n'
printf '  %s\n' "$ROOM_ROOT/engine_registry.tsv"
printf '  %s\n' "$ROOM_ROOT/connector_registry.tsv"
printf '  %s\n' "$ROOM_ROOT/server_registry.tsv"

printf '\nEVIDENCE SOURCES\n'
find "$KITTY_ROOT/evidence/journal" -maxdepth 2 -type f 2>/dev/null | sort | sed 's/^/  /'

printf '\nLATEST SNAPSHOT\n'
printf '  %s\n' "$SNAPSHOT_FILE"
