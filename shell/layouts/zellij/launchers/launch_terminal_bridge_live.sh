#!/usr/bin/env bash
set -euo pipefail

while true; do
  clear
  printf 'TERMINAL BRIDGE LIVE\n'
  printf 'updated: %s\n\n' "$(date '+%F %T %Z')"
  printf 'bridge_config: %s\n' "/home/t79/KITTY/terminal/ssh/vxstation_terminal_import.ssh.conf"
  printf '\nACTIVE SSH PROCESSES\n'
  pgrep -fa 'ssh' | sed -n '1,40p' || true
  printf '\nBRIDGE FILE\n'
  sed -n '1,80p' /home/t79/KITTY/terminal/ssh/vxstation_terminal_import.ssh.conf 2>/dev/null || echo "bridge file missing"
  sleep 5
done
