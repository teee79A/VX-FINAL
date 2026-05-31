#!/usr/bin/env bash
# VXSTATION TV — Visual rendering library
# Provides colors, box drawing, status indicators for TV Wall panels

# Colors
export C_RESET='\033[0m'
export C_BOLD='\033[1m'
export C_DIM='\033[2m'
export C_RED='\033[38;5;196m'
export C_GREEN='\033[38;5;46m'
export C_YELLOW='\033[38;5;226m'
export C_BLUE='\033[38;5;33m'
export C_CYAN='\033[38;5;51m'
export C_MAGENTA='\033[38;5;201m'
export C_ORANGE='\033[38;5;208m'
export C_WHITE='\033[38;5;255m'
export C_GRAY='\033[38;5;242m'
export C_BG_BLACK='\033[48;5;232m'
export C_BG_DARK='\033[48;5;234m'

# Box drawing
export BOX_TL='╔' BOX_TR='╗' BOX_BL='╚' BOX_BR='╝'
export BOX_H='═' BOX_V='║'
export LINE_H='─' LINE_V='│'
export LINE_TL='┌' LINE_TR='┐' LINE_BL='└' LINE_BR='┘'

# Status indicators
status_dot() {
  case "${1,,}" in
    up|online|green|running|healthy|ok) printf "${C_GREEN}●${C_RESET}" ;;
    down|offline|red|stopped|failed|error) printf "${C_RED}●${C_RESET}" ;;
    warn|yellow|degraded|unknown) printf "${C_YELLOW}●${C_RESET}" ;;
    *) printf "${C_GRAY}○${C_RESET}" ;;
  esac
}

# Header with box frame
tv_header() {
  local title="${1:-PANEL}"
  local w=${2:-60}
  local pad=$(( (w - ${#title} - 2) / 2 ))
  [[ $pad -lt 0 ]] && pad=0
  printf "${C_CYAN}${BOX_TL}"
  printf "${BOX_H}%.0s" $(seq 1 $w)
  printf "${BOX_TR}${C_RESET}\n"
  printf "${C_CYAN}${BOX_V}${C_RESET}"
  printf "%${pad}s" ""
  printf " ${C_BOLD}${C_WHITE}%s${C_RESET} " "$title"
  printf "%$(( w - pad - ${#title} - 2 ))s" ""
  printf "${C_CYAN}${BOX_V}${C_RESET}\n"
  printf "${C_CYAN}${BOX_BL}"
  printf "${BOX_H}%.0s" $(seq 1 $w)
  printf "${BOX_BR}${C_RESET}\n"
  printf " ${C_DIM}%s${C_RESET}\n\n" "$(date '+%F %T %Z')"
}

# Section divider
tv_section() {
  local label="$1"
  printf "\n ${C_BOLD}${C_CYAN}▎${C_WHITE} %s${C_RESET}\n" "$label"
  printf " ${C_DIM}%s${C_RESET}\n" "$(printf '%.0s─' $(seq 1 50))"
}

# Status row: label, status, detail
tv_row() {
  local label="$1" status="$2" detail="${3:-}"
  printf " $(status_dot "$status")  ${C_WHITE}%-22s${C_RESET} ${C_DIM}%s${C_RESET}\n" "$label" "$detail"
}

# Metric with value
tv_metric() {
  local label="$1" value="$2" unit="${3:-}"
  printf " ${C_GRAY}%-18s${C_RESET} ${C_BOLD}${C_GREEN}%s${C_RESET} ${C_DIM}%s${C_RESET}\n" "$label" "$value" "$unit"
}

# Spark bar (0-100)
tv_bar() {
  local label="$1" pct="${2:-0}" w="${3:-20}"
  local filled=$(( pct * w / 100 ))
  local empty=$(( w - filled ))
  local color="$C_GREEN"
  [[ $pct -gt 70 ]] && color="$C_YELLOW"
  [[ $pct -gt 90 ]] && color="$C_RED"
  printf " ${C_GRAY}%-14s${C_RESET} ${color}"
  printf '█%.0s' $(seq 1 $filled) 2>/dev/null
  printf "${C_GRAY}"
  [[ $empty -gt 0 ]] && printf '░%.0s' $(seq 1 $empty) 2>/dev/null
  printf "${C_RESET} ${C_DIM}%d%%${C_RESET}\n" "$pct"
}

# HTTP probe with timing
tv_probe() {
  local label="$1" url="$2"
  local result
  result=$(curl -fsS --max-time 3 -o /dev/null -w '%{http_code} %{time_total}' "$url" 2>/dev/null || echo "000 0")
  local code=$(echo "$result" | awk '{print $1}')
  local time_s=$(echo "$result" | awk '{printf "%.0fms", $2*1000}')
  if [[ "$code" =~ ^2[0-9]{2}$ ]]; then
    tv_row "$label" "up" "$code ${time_s}"
  else
    tv_row "$label" "down" "$code"
  fi
}

# Large ASCII clock
tv_clock() {
  local t
  t=$(date '+%H:%M:%S')
  printf "\n ${C_BOLD}${C_CYAN}%s${C_RESET}\n" "$t"
  printf " ${C_DIM}%s${C_RESET}\n" "$(date '+%A, %B %d %Y')"
  printf " ${C_DIM}UTC %s${C_RESET}\n" "$(date -u '+%H:%M')"
}

# Big number display  
tv_big_number() {
  local label="$1" value="$2"
  printf "\n ${C_GRAY}%s${C_RESET}\n" "$label"
  printf " ${C_BOLD}${C_GREEN}%s${C_RESET}\n" "$value"
}
