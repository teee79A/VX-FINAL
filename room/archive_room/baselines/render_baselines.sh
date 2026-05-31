#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

ensure_runtime
ensure_baseline_if_missing

print_header "ARCHIVING_ROOM / BASELINES"

if [[ -s "$BASELINE_FILE" ]]; then
  printf 'baseline_file: %s\n' "$BASELINE_FILE"
  printf 'entries:       %s\n\n' "$(wc -l < "$BASELINE_FILE" | tr -d ' ')"
  sed -n '1,60p' "$BASELINE_FILE"
else
  printf 'baseline_file: %s\n' "$BASELINE_FILE"
  printf 'entries:       0\n'
  printf '\nno baseline yet (add files into frozen_records first)\n'
fi
