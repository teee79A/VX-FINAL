#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

print_header "ARCHIVING_ROOM / OPERATOR ACTIONS"

printf 'ROOM CONTROL\n'
printf '  %s\n' "/home/t79/KITTY/bin/kitty-archive-room.sh --reset"
printf '  %s\n' "/home/t79/KITTY/bin/archive-room-report.sh"

printf '\nARCHIVE ACTIONS\n'
printf '  %s\n' "$ROOT/freeze_record.sh /path/to/file"
printf '  %s\n' "$ROOT/create_baseline.sh"
printf '  %s\n' "$ROOT/verify_integrity.sh"

printf '\nINTEGRITY STATUS\n'
printf '  %s\n' "$(integrity_check)"
