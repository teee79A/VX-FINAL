#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "COMMERCIAL ROOM — TREASURY" 52

tv_section "PAYMENT CHANNELS"
tv_row "PayPal" "green" "paypal.me — instant"
tv_row "Bitcoin" "green" "BTC network — manual"
tv_row "Bank Transfer" "green" "ACH/wire — enterprise"

tv_section "PRODUCT TIERS"
printf " ${C_WHITE}%-18s${C_RESET} ${C_GREEN}%s${C_RESET}\n" "Seal (single)" "\$2"
printf " ${C_WHITE}%-18s${C_RESET} ${C_GREEN}%s${C_RESET}\n" "Certified" "\$49/mo"
printf " ${C_WHITE}%-18s${C_RESET} ${C_GREEN}%s${C_RESET}\n" "Certified Pro" "\$149/mo"
printf " ${C_WHITE}%-18s${C_RESET} ${C_GREEN}%s${C_RESET}\n" "Enterprise" "\$499/mo"

tv_section "BILLING API"
tv_probe "Payment API" "https://vyrdx.vyrdon.com/api/v1/payments/request"

tv_section "ROOM MODULES"
for mod in live_control_surface runtime_status operator_actions execution_monitoring evidence_linked_room_state; do
  dir="/home/t79/KITTY/COMMERCIAL_ROOM/$mod"
  if [[ -d "$dir" ]]; then
    tv_row "$mod" "green"
  else
    tv_row "$mod" "red" "missing"
  fi
done

tv_section "CONTACTS"
printf " ${C_CYAN}billing@vyrdon.com${C_RESET}      — payment inquiries\n"
printf " ${C_CYAN}contact@vyrdon.com${C_RESET}      — general\n"
printf " ${C_CYAN}authority@vyrdon.com${C_RESET}     — governance\n"
printf " ${C_CYAN}verification@vyrdon.com${C_RESET}  — seal verification\n"
