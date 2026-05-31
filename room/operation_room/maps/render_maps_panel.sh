#!/usr/bin/env bash
set -euo pipefail
source /home/t79/KITTY/room/tv_common.sh

tv_header "NODE TOPOLOGY — MESH" 52

tv_section "TAILSCALE NODES"
if command -v tailscale >/dev/null 2>&1; then
  tailscale status --json 2>/dev/null | jq -r '.Peer | to_entries[] | "\(.value.HostName) \(.value.TailscaleIPs[0] // "?") \(if .value.Online then "online" else "offline" end)"' 2>/dev/null | while read -r host ip state; do
    tv_row "$host" "$state" "$ip"
  done
  # Self
  self_ip=$(tailscale status --json 2>/dev/null | jq -r '.Self.TailscaleIPs[0] // "?"')
  self_host=$(tailscale status --json 2>/dev/null | jq -r '.Self.HostName // "?"')
  tv_row "$self_host (self)" "green" "$self_ip"
else
  tv_row "tailscale" "red" "not installed"
fi

tv_section "CLOUD TARGETS"
TARGETS="/home/t79/KITTY/data/vxstation_control/cloud_target_manager.json"
if [[ -f "$TARGETS" ]]; then
  jq -r '.[] | "\(.target_id) \(.probe_url)"' "$TARGETS" 2>/dev/null | while read -r tid url; do
    tv_probe "$tid" "$url"
  done
else
  printf " ${C_DIM}no cloud targets configured${C_RESET}\n"
fi

tv_section "NETWORK INTERFACES"
ip -brief addr show 2>/dev/null | grep -v lo | while read -r iface state addrs; do
  tv_row "$iface" "$( [[ $state == UP ]] && echo green || echo red)" "$addrs"
done
