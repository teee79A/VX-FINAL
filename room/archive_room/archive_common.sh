#!/usr/bin/env bash
set -euo pipefail

ROOM_ROOT="/home/t79/KITTY/ARCHIVING_ROOM"
KITTY_ROOT="/home/t79/KITTY"
RUNTIME_ROOT="$ROOM_ROOT/runtime"
BASELINE_FILE="$ROOM_ROOT/baselines/current_baseline.sha256"
AUDIT_FILE="$KITTY_ROOT/evidence/journal/archive_room.audit.jsonl"

print_header() {
  local title="${1:-ARCHIVING_ROOM}"
  printf '%s\n' "$title"
  printf 'updated: %s\n' "$(date '+%F %T %Z')"
  printf 'room:    %s\n' "$ROOM_ROOT"
  printf '\n'
}

ensure_runtime() {
  mkdir -p "$RUNTIME_ROOT/state" "$RUNTIME_ROOT/logs" "$ROOM_ROOT/evidence_linked_room_state/snapshots"
  mkdir -p "$(dirname "$AUDIT_FILE")"
}

print_tsv() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf 'missing file: %s\n' "$file"
    return 0
  fi
  if command -v column >/dev/null 2>&1; then
    column -t -s $'\t' "$file"
  else
    cat "$file"
  fi
}

write_audit() {
  local event="$1"
  local details="$2"
  ensure_runtime
  printf '{"timestamp":"%s","event":"%s","details":"%s"}\n' \
    "$(date -u '+%FT%TZ')" "$event" "$details" >> "$AUDIT_FILE"
}

list_sections() {
  local sections=(
    "frozen_records"
    "change_history"
    "baselines"
    "signed_logs"
    "rollback_reference_state"
  )
  local section
  for section in "${sections[@]}"; do
    local count
    count="$(find "$ROOM_ROOT/$section" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')"
    printf '%-28s | files=%s\n' "$section" "$count"
  done
}

list_recent_files() {
  find "$ROOM_ROOT" -mindepth 2 -maxdepth 3 -type f \
    -printf '%TY-%Tm-%Td %TH:%TM:%TS %p\n' 2>/dev/null | sort -r | head -n 25
}

hash_frozen_records() {
  find "$ROOM_ROOT/frozen_records" -type f -print0 2>/dev/null \
    | sort -z \
    | while IFS= read -r -d '' file; do
        sha256sum "$file"
      done
}

ensure_baseline_if_missing() {
  ensure_runtime
  if [[ -s "$BASELINE_FILE" ]]; then
    return 0
  fi
  if find "$ROOM_ROOT/frozen_records" -type f | grep -q .; then
    hash_frozen_records > "$BASELINE_FILE"
    write_audit "baseline.created" "$BASELINE_FILE"
  fi
}

integrity_check() {
  ensure_baseline_if_missing
  if [[ ! -s "$BASELINE_FILE" ]]; then
    echo "NO_BASELINE"
    return 0
  fi
  local current_file
  current_file="$(mktemp)"
  hash_frozen_records > "$current_file"
  if diff -u "$BASELINE_FILE" "$current_file" >/dev/null 2>&1; then
    rm -f "$current_file"
    echo "PASS"
    return 0
  fi
  rm -f "$current_file"
  echo "FAIL"
}

check_cmd() {
  local label="$1"
  local cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%-18s | %-7s | %s\n' "$label" "online" "$(command -v "$cmd")"
  else
    printf '%-18s | %-7s | %s\n' "$label" "missing" "-"
  fi
}
