#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "TIME & CALENDAR" 44

# Large time display
local_time=$(date '+%H:%M:%S')
local_date=$(date '+%A, %B %d %Y')
utc_time=$(date -u '+%H:%M:%S UTC')
epoch=$(date +%s)

printf " ${C_BOLD}${C_CYAN}%s${C_RESET}\n" "$local_time"
printf " ${C_WHITE}%s${C_RESET}\n" "$local_date"
printf " ${C_DIM}%s  |  epoch %s${C_RESET}\n" "$utc_time" "$epoch"

tv_section "CALENDAR"
python3 -c "
import calendar, datetime
now = datetime.datetime.now()
cal = calendar.TextCalendar(calendar.MONDAY)
lines = cal.formatmonth(now.year, now.month).split('\n')
today = str(now.day)
for line in lines:
    # Highlight today's date
    words = line.split()
    out = []
    for w in words:
        if w == today:
            out.append('\033[1;38;5;46m' + w + '\033[0m')
        else:
            out.append(w)
    print('  ' + ' '.join(out) if out else '')
print(f'  \033[2mWeek {now.isocalendar()[1]} | Day {now.timetuple().tm_yday}/365\033[0m')
"

tv_section "MCP TIME SERVICE"
tv_probe "mcp-time-cal" "http://127.0.0.1:8792/health"

printf "\n ${C_DIM}uptime: $(uptime -p | sed 's/up //')${C_RESET}\n"
