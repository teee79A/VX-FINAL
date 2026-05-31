#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

KITTY_ROOT="/home/t79/KITTY"
OPS_STATUS="$KITTY_ROOT/OPERATION_ROOM/monitoring/latest_status.json"

tv_header "VXSTATION — OPERATION ROOM" 56

tv_section "SYSTEM"
tv_metric "Uptime" "$(uptime -p | sed 's/up //')"
tv_metric "Load" "$(cat /proc/loadavg | awk '{print $1, $2, $3}')"
tv_metric "Memory" "$(free -h | awk '/Mem:/{printf "%s / %s", $3, $2}')"

tv_section "ROOM MODULES"
for mod in live_control_surface runtime_status operator_actions execution_monitoring evidence_linked_room_state; do
  if [[ -d "$KITTY_ROOT/OPERATION_ROOM/$mod" ]]; then
    tv_row "$mod" "green"
  else
    tv_row "$mod" "red" "missing"
  fi
done

tv_section "LOCAL SERVICES"
tv_probe "AgentGateway" "http://127.0.0.1:46080/health"
tv_probe "Netdata" "http://127.0.0.1:19999/api/v1/info"
tv_probe "ClickHouse" "http://127.0.0.1:8123/ping"
tv_probe "Airflow" "http://127.0.0.1:8080/health"
tv_probe "MCP Voice" "http://127.0.0.1:8790/health"
tv_probe "MCP Time" "http://127.0.0.1:8792/health"

tv_section "CLOUD TARGETS"
tv_probe "vyrdx.vyrdon.com" "https://vyrdx.vyrdon.com/api/build"
tv_probe "consolab.vyrdon.com" "https://consolab.vyrdon.com/health"

status="unknown"
[[ -f "$OPS_STATUS" ]] && status=$(jq -r '.overall_status // "unknown"' "$OPS_STATUS" 2>/dev/null)
printf "\n ${C_BOLD}OVERALL: $(status_dot "$status") ${C_WHITE}%s${C_RESET}\n" "$status"
