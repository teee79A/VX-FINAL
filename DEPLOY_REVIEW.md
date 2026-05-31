# DEPLOY REVIEW — KITTY to DigitalOcean Droplet

> Date: 2026-04-17
> Target: vyrdon-prod-01 (134.199.227.138, sfo3, Ubuntu 24.04, 4GB/2vCPU)
> SSH: `root@134.199.227.138` via `/home/t79/.ssh/id_deploy_vyrdon`

---

## 1. Deploy Source of Truth

- **Artifact**: KITTY (`/opt/kitty`) — the control/runtime plane
- **Method**: rsync source to droplet + systemd (no Docker on droplet — matches AI Room pattern)
- **Entry**: `npx tsx server/index.ts` (port 7800)
- **KITTY is the droplet artifact.** It ships as the always-on control surface.
- **/opt/vyrdx stays local.** It is the DELL-side installed runtime. Not deployed to cloud.
- **VYRDx is the cloud runtime layer.** KITTY on the droplet is the first piece of it.

---

## 2. Image/Tag Strategy

No container image. Direct systemd like vyrden-airoom:
- rsync source → `/opt/vxstation/` on droplet
- `npm ci --omit=dev` on droplet
- systemd service: `vxstation.service`
- Cloudflare tunnel: `vyrdx.vyrdon.com → http://localhost:7800`

---

## 3. Required Env Vars

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `KITTY_ROOT` | yes | `/opt/vxstation` | on droplet |
| `VXSTATION_PORT` | yes | `7800` | |
| `VXSTATION_HOST` | yes | `0.0.0.0` | |
| `NODE_ENV` | yes | `production` | |
| `VYRDX_ROOT` | no | `/opt/vyrdx` | bridge target — not present on droplet |
| `VYRDOX_CORE_BASE` | no | `/opt/vyrdx/core` | bridge will degrade gracefully |

Bridge env vars (`POSTGRES_URL`, `REDIS_URL`, attestation paths) are only needed
when VYRDX runtime is co-located. On droplet, bridge returns defaults/nulls.

---

## 4. Droplet Prerequisites

| Requirement | Status |
|-------------|--------|
| SSH access | ✅ `root@134.199.227.138` via id_deploy_vyrdon |
| Node.js 22 | ❌ needs install |
| npm | ❌ needs install |
| rsync | ✅ (Ubuntu default) |
| cloudflared | ❌ needs install |
| systemd | ✅ |

---

## 5. Registry vs Remote-Build Strategy

**Decision: remote-build on droplet** (no registry needed)

```
Dell (KITTY) --rsync--> Droplet (/opt/vxstation)
                         npm ci --omit=dev
                         systemctl start vxstation
```

No Docker. No registry. No image push. Direct source deploy like vyrden-airoom.

---

## 6. Exact Files to Patch

| File | Action | Reason |
|------|--------|--------|
| `deploy/vxstation.service` | rewrite | paths must be `/opt/vxstation`, user `root` (fresh droplet) |
| `deploy/deploy.sh` | rewrite | rsync + SSH deploy, not Docker push |
| `deploy/.env.example` | update | remove Docker/registry vars, add droplet vars |
| `.dockerignore` | create | still useful for Docker builds if needed later |
| `deploy/droplet-setup.sh` | create | one-shot droplet provisioning (node, cloudflared) |

Files that need NO changes:
- `deploy/Dockerfile` — keep for future Docker path, not used now
- `deploy/docker-compose.yml` — keep for local dev, not used for droplet
- `deploy/cloudflare-tunnel.yml` — already correct
- `server/index.ts` — no changes needed
- `package.json` — already has `"start": "tsx server/index.ts"`

---

## 7. Exact Blockers

| # | Blocker | Severity | Fix |
|---|---------|----------|-----|
| 1 | Node.js not installed on droplet | CRITICAL | droplet-setup.sh |
| 2 | vyrdx-bridge will fail on droplet (no /opt/vyrdx) | HIGH | graceful degradation — bridge returns nulls |
| 3 | No Cloudflare tunnel configured | MEDIUM | install cloudflared + config |
| 4 | vxstation.service has Dell paths | MEDIUM | rewrite for /opt/vxstation |
| 5 | deploy.sh assumes Docker registry | MEDIUM | rewrite for rsync |

---

## 8. /opt/vyrdx Stays Local

`/opt/vyrdx` is the installed JavaScript runtime on the DELL machine.
It runs 5 systemd services (chain-verifier, feed-engine, codex, rtmp-auth, attest-verify).
It is NOT part of the droplet deploy. It stays on DELL.

The vyrdx-bridge in KITTY wraps `/opt/vyrdx` modules via dynamic `import()`.
On the droplet, these imports will fail gracefully — bridge methods return null/defaults.
Future: bridge can be extended to call VYRDX over HTTP/tunnel instead of local import.

---

## 9. KITTY Is the Droplet Artifact

KITTY ships as the always-on control/runtime plane:
- CEO conductor with 10 engine layers + 10 server layers
- Evidence hash chain + JSONL audit
- Commercial/market/observability APIs
- WebSocket telemetry at /ws
- Health endpoint at /health

---

## 10. VYRDx Is the Cloud Runtime Layer

KITTY on the droplet is the first piece of the VYRDx cloud runtime.
Future additions: postgres, redis, full bridge, campaign/AI room services.
The droplet is the staging ground for the complete VYRDx cloud architecture.
