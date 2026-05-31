#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  zsh-automation-hub.sh install
  zsh-automation-hub.sh sales-cycle
  zsh-automation-hub.sh fulfillment
  zsh-automation-hub.sh handoff
  zsh-automation-hub.sh status
EOF
}

cmd="${1:-status}"

case "$cmd" in
  install)
    target_dir="$HOME/.oh-my-zsh/custom"
    mkdir -p "$target_dir"
    ln -sfn /home/t79/KITTY/shell/zsh/vxstation-automation-hub.zsh "$target_dir/vxstation-automation-hub.zsh"
    echo "Installed Oh My Zsh automation hub plugin link: $target_dir/vxstation-automation-hub.zsh"
    ;;
  sales-cycle)
    /home/t79/KITTY/bin/ops-brain.sh run sales_cycle
    ;;
  fulfillment)
    /home/t79/KITTY/bin/ops-brain.sh run fulfillment
    ;;
  handoff)
    /home/t79/KITTY/bin/ops-brain.sh run ops_handoff
    ;;
  status)
    echo "ZSH Automation Hub ready"
    echo "Ops Brain outcomes:"
    /home/t79/KITTY/bin/ops-brain.sh list
    ;;
  *)
    usage
    exit 1
    ;;
esac
