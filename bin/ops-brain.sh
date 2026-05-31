#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY/OPERATION_ROOM/ops_brain"
SOPS_DIR="$ROOT/sops"

usage() {
  cat <<'EOF'
Usage:
  ops-brain.sh list
  ops-brain.sh run <sales_cycle|fulfillment|ops_handoff>
EOF
}

cmd="${1:-list}"

case "$cmd" in
  list)
    echo "Available outcomes:"
    ls -1 "$SOPS_DIR" | sed 's/.md$//' | sort
    ;;
  run)
    outcome="${2:-}"
    if [[ -z "$outcome" ]]; then
      usage
      exit 1
    fi
    sop="$SOPS_DIR/$outcome.md"
    if [[ ! -f "$sop" ]]; then
      echo "Unknown outcome: $outcome" >&2
      exit 1
    fi
    echo "Running outcome SOP: $outcome"
    echo "SOP file: $sop"
    sed -n '1,200p' "$sop"
    ;;
  *)
    usage
    exit 1
    ;;
esac
