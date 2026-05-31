#!/bin/bash
# TITAN-IDE Deployment Script
# Deploys TITAN stack to Desktop and verifies installation

set -euo pipefail

TITAN_SOURCE="/home/t79/generic/apps/jetbrains/titan_ide"
TITAN_DESKTOP="/home/t79/Desktop/TITAN-IDE"

echo "=== TITAN-IDE Deployment ==="
echo "Source: $TITAN_SOURCE"
echo "Target: $TITAN_DESKTOP"

# Verify source exists
if [ ! -d "$TITAN_SOURCE" ]; then
    echo "ERROR: TITAN source not found: $TITAN_SOURCE"
    exit 1
fi

# Remove existing Desktop version first
rm -rf "$TITAN_DESKTOP"

# Create target directory
mkdir -p "$TITAN_DESKTOP"

# Deploy using Python (exclude .git directories to avoid permission issues)
/usr/bin/python3 -c "
import shutil
import os

src = '$TITAN_SOURCE'
dst = '$TITAN_DESKTOP'

for item in os.listdir(src):
    if item == '.git':
        continue
    s = os.path.join(src, item)
    d = os.path.join(dst, item)
    if os.path.isdir(s):
        shutil.copytree(s, d, ignore=lambda d, names: ['.git'])
    else:
        shutil.copy2(s, d)
"

# Verify deployment
if [ -d "$TITAN_DESKTOP" ]; then
    echo "✓ TITAN-IDE deployed to Desktop"
    echo "  Location: $TITAN_DESKTOP"
    echo "  Components:"
    ls -1 "$TITAN_DESKTOP" | sed 's/^/    - /'
else
    echo "ERROR: Deployment failed"
    exit 1
fi

# Verify backend
if [ -f "$TITAN_DESKTOP/backend/titan_ide_backend.py" ]; then
    echo "✓ Backend verified"
else
    echo "ERROR: Backend missing"
    exit 1
fi

# Verify frontend
if [ -d "$TITAN_DESKTOP/frontend/dist" ]; then
    echo "✓ Frontend verified"
else
    echo "ERROR: Frontend missing"
    exit 1
fi

# Create SHA256 baseline
mkdir -p /home/t79/KITTY/ARCHIVING_ROOM/baselines
BASELINE_FILE="/home/t79/KITTY/ARCHIVING_ROOM/baselines/titan_ide_baseline.sha256"
sha256sum "$TITAN_DESKTOP/backend/titan_ide_backend.py" > "$BASELINE_FILE"
echo "✓ Baseline archived: $BASELINE_FILE"

echo ""
echo "=== Deployment Complete ==="
echo "To start TITAN-IDE:"
echo "  cd $TITAN_DESKTOP"
echo "  ./TITAN-IDE.sh"
