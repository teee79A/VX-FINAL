#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "MARKET BOARD — LIVE" 52

tv_section "EQUITIES (USD)"
for sym in aapl.us msft.us nvda.us googl.us amzn.us tsla.us meta.us; do
  ticker=$(echo "$sym" | sed 's/\.us$//' | tr '[:lower:]' '[:upper:]')
  price=$(curl -fsS --max-time 3 "https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv" 2>/dev/null | tail -1 | awk -F',' '{print $7}')
  if [[ -n "$price" && "$price" != "N/D" && "$price" != "0" ]]; then
    printf " ${C_GREEN}▲${C_RESET} ${C_BOLD}${C_WHITE}%-6s${C_RESET}  ${C_GREEN}\$%s${C_RESET}\n" "$ticker" "$price"
  else
    printf " ${C_RED}─${C_RESET} ${C_DIM}%-6s${C_RESET}  ${C_DIM}unavailable${C_RESET}\n" "$ticker"
  fi
done

tv_section "CRYPTO"
for pair in btc.v eth.v; do
  ticker=$(echo "$pair" | sed 's/\.v$//' | tr '[:lower:]' '[:upper:]')
  price=$(curl -fsS --max-time 3 "https://stooq.com/q/l/?s=${pair}&f=sd2t2ohlcv&h&e=csv" 2>/dev/null | tail -1 | awk -F',' '{print $7}')
  if [[ -n "$price" && "$price" != "N/D" && "$price" != "0" ]]; then
    printf " ${C_CYAN}◆${C_RESET} ${C_BOLD}${C_WHITE}%-6s${C_RESET}  ${C_CYAN}\$%s${C_RESET}\n" "$ticker" "$price"
  else
    printf " ${C_RED}─${C_RESET} ${C_DIM}%-6s${C_RESET}  ${C_DIM}unavailable${C_RESET}\n" "$ticker"
  fi
done

printf "\n ${C_DIM}source: stooq.com | %s${C_RESET}\n" "$(date '+%H:%M:%S %Z')"
