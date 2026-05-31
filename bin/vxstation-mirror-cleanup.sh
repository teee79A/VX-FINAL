#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_DIR="/home/t79/KITTY/ARCHIVING_ROOM/vxstation-mirror-retire-${STAMP}"

CANDIDATES=(
  "/home/t79/VXSTATION"
  "/home/t79/VYRDON/VXSTATION"
)

usage() {
  cat <<'EOF'
Usage:
  vxstation-mirror-cleanup.sh [--dry-run|--execute]

Modes:
  --dry-run  Show what would be archived and deleted (default)
  --execute  Archive mirror folders into KITTY, then delete originals
EOF
}

if [[ "$MODE" != "--dry-run" && "$MODE" != "--execute" ]]; then
  usage
  exit 2
fi

echo "[info] mode: $MODE"
echo "[info] archive target: $ARCHIVE_DIR"

for path in "${CANDIDATES[@]}"; do
  if [[ -d "$path" ]]; then
    echo "[found] $path"
  elif [[ -L "$path" ]]; then
    echo "[found] $path (symlink)"
  else
    echo "[skip]  $path (missing)"
  fi
done

if [[ "$MODE" == "--dry-run" ]]; then
  echo "[done] dry-run only; no changes made"
  exit 0
fi

mkdir -p "$ARCHIVE_DIR"

for path in "${CANDIDATES[@]}"; do
  if [[ -L "$path" && ! -d "$path" ]]; then
    echo "[unlink] stale symlink: $path"
    unlink "$path"
    continue
  fi

  [[ -d "$path" ]] || continue
  name="$(basename "$path")"
  parent="$(basename "$(dirname "$path")")"
  archive_file="$ARCHIVE_DIR/${parent}-${name}.tar.gz"

  echo "[archive] $path -> $archive_file"
  tar -C / -czf "$archive_file" "${path#/}"

  echo "[delete] $path"
  rm -rf "$path"
done

echo "[done] mirror cleanup complete"
