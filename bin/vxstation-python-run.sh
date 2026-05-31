#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/t79/KITTY"
VENV_PYTHON="$ROOT/.venv/bin/python3"

if [[ -x "$VENV_PYTHON" ]]; then
  exec "$VENV_PYTHON" "$@"
fi

if command -v python3 >/dev/null 2>&1; then
  exec "$(command -v python3)" "$@"
fi

if command -v python >/dev/null 2>&1; then
  exec "$(command -v python)" "$@"
fi

echo "missing python runtime" >&2
exit 1
