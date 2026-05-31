<!-- AUTO-GENERATED from deploy/, server/, consolab/ -->
<!-- Last updated: 2026-04-16 | Source: update-docs skill -->

# VXSTATION Runbook

## Quick Start (Development)

```bash
cd /opt/kitty
npm install
npm start                     # Fastify on :7800
```

## Health Checks

| Service | Endpoint | Expected |
|---------|----------|----------|
| VXSTATION server | `GET /health` | `{ status: "ok", uptime: N }` |
| ConsoLab authority | `GET /health` on :7900 | `{ status: "ok", ... }` |

```bash
curl http://localhost:7800/health
curl http://localhost:7900/health
```

## Deployment (DigitalOcean)

For the standalone AI room domain (`vyrden.com`), use:
- `docs/runbooks/vyrden-airoom-cloudflare-deploy.md`
- `deploy/deploy-vyrden-airoom.sh`

### Prerequisites
- Docker installed on droplet
- DO container registry configured
- Cloudflare Tunnel token ready
- `.env` file populated from `deploy/.env.example`

### Deploy Steps

```bash
cd deploy
cp .env.example .env           # fill in real values
chmod +x deploy.sh
./deploy.sh                    # builds, tags, pushes, SSHs, pulls, restarts
```

### Manual Deploy

```bash
# Build
docker compose -f deploy/docker-compose.yml build

# Push to registry
docker tag vxstation:latest $DO_REGISTRY/vxstation:latest
docker push $DO_REGISTRY/vxstation:latest

# On droplet
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d
```

### Systemd Service

```bash
sudo cp deploy/vxstation.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vxstation
```

## Container Architecture

| Service | Image | Port | Health Check |
|---------|-------|------|-------------|
| vxstation | `node:22-slim` + tsx | 7800 | `fetch(/health)` every 15s |
| postgres | `postgres:17-alpine` | 5432 (localhost only) | `pg_isready` every 10s |
| redis | `redis:7-alpine` | 6379 (localhost only) | `redis-cli ping` every 10s |

## Cloudflare Tunnel

```bash
# Install cloudflared
cloudflared tunnel login
cloudflared tunnel run --config deploy/cloudflare-tunnel.yml
```

Routes:
- `vyrdx.vyrdon.com` → `http://localhost:7800`
- `consollab.vyrdon.com` → `http://localhost:7900`

## Common Issues

### 1. Attestation Token Expired
**Symptom:** Services start in `DEGRADED_READONLY` mode
**Fix:** Ensure ASUS authority is reachable, then:
```bash
node /opt/vyrdx/services/refresh-attestation-token-remote.js
systemctl restart vyrdx-feed vyrdx-chain vyrdx-codex vyrdx-core
```

### 2. Evidence Hash Chain Corrupt
**Symptom:** `hash-chain.ts` throws "chain integrity check failed"
**Fix:** Check `evidence/journal/command_bus.hash.head` — must contain valid SHA-256.
Restore from latest known-good backup or reset chain with GENESIS.

### 3. Build Fails on Import Extensions
**Symptom:** `Cannot find module './foo'`
**Fix:** All imports must use `.js` extension: `import { X } from './foo.js'`

### 4. Port Already in Use
**Symptom:** `EADDRINUSE`
**Fix:** `lsof -i :7800` to find blocking process, or change `VXSTATION_PORT`

## Rollback

```bash
# Docker rollback
docker compose -f deploy/docker-compose.yml down
docker tag vxstation:previous vxstation:latest
docker compose -f deploy/docker-compose.yml up -d

# Git rollback
git revert HEAD
npm run ci:mandatory
npm start
```

## Monitoring

- **Observability API:** `GET /api/observability/snapshot` — full system state
- **Hardware:** `GET /api/observability/hardware` — CPU, memory, disk
- **Security:** `GET /api/observability/security` — scan results
- **Services:** `GET /api/observability/services` — VYRDX service status
- **WebSocket:** `ws://localhost:7800/ws` — live telemetry stream (30s interval)
