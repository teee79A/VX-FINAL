#!/usr/bin/env bash
set -euo pipefail

KITTY_ROOT="/home/t79/KITTY"
ARCHIVE_ROOT="$KITTY_ROOT/ARCHIVING_ROOM"
STATE_DIR="$ARCHIVE_ROOT/runtime/state"
FREEZE_SCRIPT="$KITTY_ROOT/room/archive_room/freeze_record.sh"
BASELINE_SCRIPT="$KITTY_ROOT/room/archive_room/create_baseline.sh"

mkdir -p "$STATE_DIR"

STATION_SNAPSHOT="$STATE_DIR/station_snapshot_latest.json"
python3 "$KITTY_ROOT/bin/station-map.py" --pretty > "$STATION_SNAPSHOT"

FILES_TO_FREEZE=(
  "$KITTY_ROOT/data/vxstation_control/room_router.json"
  "$KITTY_ROOT/FEEDBACK_CLOUD_VYRDX_ROOM/runtime/state/latest_runtime_status.txt"
  "$KITTY_ROOT/FEEDBACK_CLOUD_VYRDX_ROOM/evidence_linked_room_state/snapshots/latest_snapshot.txt"
  "$STATION_SNAPSHOT"
  "$KITTY_ROOT/evidence/journal/command_bus.audit.jsonl"
  "$KITTY_ROOT/evidence/journal/module_actions.jsonl"
)

for file in "${FILES_TO_FREEZE[@]}"; do
  if [[ -f "$file" ]]; then
    bash "$FREEZE_SCRIPT" "$file"
  fi
done

bash "$BASELINE_SCRIPT"
echo "archive room baseline refreshed"
