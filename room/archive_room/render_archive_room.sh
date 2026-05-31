#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/archive_room"
# shellcheck source=/dev/null
source "$ROOT/archive_common.sh"

ensure_runtime
status="$(integrity_check)"

print_header "ARCHIVING_ROOM / TV OVERVIEW"

printf 'ARCHIVE SECTIONS\n'
list_sections

printf '\nINTEGRITY\n'
printf 'baseline:  %s\n' "$BASELINE_FILE"
printf 'status:    %s\n' "$status"

printf '\nTOOL STATUS\n'
printf '%-18s | %-7s | %s\n' "tool" "state" "path"
printf '%s\n' "----------------------------------------------------------------"
check_cmd "sha256sum" "sha256sum"
check_cmd "gpg" "gpg"
check_cmd "tar" "tar"
check_cmd "gzip" "gzip"
check_cmd "zstd" "zstd"
check_cmd "rsync" "rsync"
check_cmd "timg" "timg"

printf '\nRECENT ARCHIVE FILES\n'
list_recent_files
