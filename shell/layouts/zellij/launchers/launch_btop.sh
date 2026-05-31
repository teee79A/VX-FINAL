#!/usr/bin/env bash
set -euo pipefail

if command -v btop >/dev/null 2>&1; then
  exec btop
fi

if command -v htop >/dev/null 2>&1; then
  exec htop
fi

exec top
