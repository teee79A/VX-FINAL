#!/usr/bin/env bash
set -euo pipefail

# Droplet one-shot setup — installs Node.js 22, cloudflared, creates dirs.
# Run via: ssh root@DROPLET < deploy/droplet-setup.sh

log() { echo "[setup] $(date +%H:%M:%S) $*"; }

log "Starting droplet provisioning..."

# Node.js 22 via NodeSource
if ! command -v node &>/dev/null || [[ "$(node --version)" != v22* ]]; then
  log "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  log "Node.js 22 already installed: $(node --version)"
fi

# Cloudflared
if ! command -v cloudflared &>/dev/null; then
  log "Installing cloudflared..."
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  apt-get install -y cloudflared
else
  log "cloudflared already installed: $(cloudflared --version)"
fi

# Create artifact runtime directories
mkdir -p /opt/vxstation/releases
mkdir -p /opt/vxstation/shared/evidence/journal/command_backbone
mkdir -p /opt/vxstation/shared/logs
mkdir -p /opt/vyrden-airoom/releases
mkdir -p /opt/vyrden-airoom/shared/logs
mkdir -p /opt/vyrden-airoom/shared/.vyrdon-memory
mkdir -p /opt/vyrden-airoom/shared/vyrden-airoom/agents
mkdir -p /opt/vyrden-airoom/shared/vyrden-airoom/evidence/requests
mkdir -p /opt/vyrden-airoom/shared/vyrden-airoom/evidence/agents
mkdir -p /opt/vyrden-airoom/shared/vyrden-airoom/evidence/audit

# Verify
log "Node: $(node --version)"
log "npm: $(npm --version)"
log "cloudflared: $(cloudflared --version 2>&1 | head -1)"
log "Droplet setup complete."
