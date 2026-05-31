#!/usr/bin/env bash
set -euo pipefail

printf 'OPERATION_ROOM / FILESYSTEM PANEL\n'
printf 'updated: %s\n\n' "$(date '+%F %T %Z')"

printf '/home/t79/KITTY/OPERATION_ROOM\n'
find /home/t79/KITTY/OPERATION_ROOM -maxdepth 3 -print | sort

printf '\n/home/t79/KITTY/OPERATION_ROOM\n'
find /home/t79/KITTY/OPERATION_ROOM -maxdepth 3 -print | sort
