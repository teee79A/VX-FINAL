#!/usr/bin/env bash
set -euo pipefail

printf 'OPERATION_ROOM / CALENDAR\n'
printf 'updated: %s\n\n' "$(date '+%F %T %Z')"

# Calendar via python3
python3 -c "
import calendar, datetime
now = datetime.datetime.now()
c = calendar.TextCalendar()
c.prmonth(now.year, now.month)
" 2>/dev/null

printf '\n'
printf 'TODAY: %s\n' "$(date '+%A, %B %d %Y')"
printf 'WEEK:  %s\n' "$(date '+%V')"
printf 'DOY:   %s/365\n' "$(date '+%j')"
printf '\nUPTIME: %s\n' "$(uptime -p 2>/dev/null || uptime)"

# Show next cron jobs if any
if crontab -l >/dev/null 2>&1; then
  printf '\nSCHEDULED JOBS\n'
  crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' | head -5
fi
