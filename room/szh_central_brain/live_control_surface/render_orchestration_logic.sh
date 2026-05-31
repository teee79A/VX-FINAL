#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/room/szh_central_brain"
# shellcheck source=/dev/null
source "$ROOT/szh_common.sh"

ROUTER_FILE="/home/t79/KITTY/data/vxstation_control/room_router.json"

print_header "SZH_CENTRAL_BRAIN / ORCHESTRATION LOGIC"

printf 'ORCHESTRATION DOMAINS\n'
list_orchestration_domains

printf '\nDOMAIN CONTENT (READMEs)\n'
for domain in orchestration_logic policy_routing state_synthesis cross_room_coordination decision_support; do
  readme="$ROOM_ROOT/$domain/README.md"
  if [[ -f "$readme" ]]; then
    printf '\n[%s]\n' "$domain"
    sed -n '1,20p' "$readme"
  else
    printf '\n[%s]\nmissing README\n' "$domain"
  fi
done

printf '\nROOM ROUTER SUMMARY\n'
if [[ -f "$ROUTER_FILE" ]] && command -v jq >/dev/null 2>&1; then
  jq -r '.routes[]? | "\(.route_id // .room_id // "-")\t\(.target_room // .room_id // "-")\t\(.state // .observed_state // "unknown")"' "$ROUTER_FILE" \
    | while IFS=$'\t' read -r route_id target_room state; do
        printf '%-26s | %-30s | %s\n' "$route_id" "$target_room" "$state"
      done
else
  echo "room router file missing or jq unavailable"
fi
