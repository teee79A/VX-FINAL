#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "SYSTEM POWER — MONITOR" 48

tv_section "CPU & MEMORY"
cpu_pct=$(top -bn1 | grep '^%Cpu' | awk '{printf "%.0f", 100-$8}' 2>/dev/null || echo "?")
mem_info=$(free | awk '/Mem:/{printf "%.0f", $3/$2*100}')
disk_pct=$(df / | awk 'NR==2{print $5}' | tr -d '%')
swap_info=$(free | awk '/Swap:/{if($2>0) printf "%.0f", $3/$2*100; else print "0"}')

tv_bar "CPU" "${cpu_pct:-0}"
tv_bar "Memory" "${mem_info:-0}"
tv_bar "Disk /" "${disk_pct:-0}"
tv_bar "Swap" "${swap_info:-0}"

tv_section "TEMPERATURES"
if command -v sensors >/dev/null 2>&1; then
  sensors 2>/dev/null | grep -E '(Core|CPU|temp)' | head -6 | while read -r line; do
    printf " ${C_DIM}%s${C_RESET}\n" "$line"
  done
else
  printf " ${C_DIM}lm-sensors not available${C_RESET}\n"
fi

tv_section "TOP PROCESSES"
printf " ${C_GRAY}%-6s %-6s %-6s %s${C_RESET}\n" "PID" "CPU%" "MEM%" "COMMAND"
ps aux --sort=-%cpu | awk 'NR>1 && NR<=8{printf " %-6s %-6s %-6s %s\n", $2, $3, $4, $11}' 2>/dev/null

tv_section "DISK I/O"
if command -v iostat >/dev/null 2>&1; then
  iostat -d 1 1 2>/dev/null | tail -5 | while read -r line; do
    [[ -n "$line" ]] && printf " ${C_DIM}%s${C_RESET}\n" "$line"
  done
fi
