#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "MEDIA — VIDEO ENGINE" 48

tv_section "VIDEO TOOLS"
for cmd in ffmpeg ffplay mpv chafa timg; do
  if command -v "$cmd" >/dev/null 2>&1; then
    tv_row "$cmd" "green" "$(command -v "$cmd")"
  else
    tv_row "$cmd" "red" "not installed"
  fi
done

tv_section "ACTIVE VIDEO PROCESSES"
found=0
for pattern in ffplay mpv ffmpeg timg chafa vlc; do
  match="$(pgrep -fa "$pattern" 2>/dev/null | head -n 1 || true)"
  if [[ -n "$match" ]]; then
    tv_row "$pattern" "running" "$(echo "$match" | cut -c1-50)"
    found=1
  fi
done
[[ $found -eq 0 ]] && printf " ${C_DIM}no active video processes${C_RESET}\n"

tv_section "MEDIAMTX RTMP"
if pgrep -f mediamtx >/dev/null 2>&1; then
  tv_row "MediaMTX" "green" "RTMP server active"
else
  tv_row "MediaMTX" "yellow" "not running"
fi

tv_section "RECENT MEDIA FILES"
find /home/t79/KITTY/evidence/ -maxdepth 3 -type f \( -name '*.mp4' -o -name '*.webm' -o -name '*.png' -o -name '*.jpg' \) -printf '%TY-%Tm-%Td %TH:%TM  %s  %f\n' 2>/dev/null | sort -r | head -8 || printf " ${C_DIM}no media files${C_RESET}\n"
