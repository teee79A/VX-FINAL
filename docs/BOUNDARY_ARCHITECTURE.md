# VYRDON BOUNDARY ARCHITECTURE
**Hardened 2026-04-28**

## Node Map

```
┌─────────────────────────────────────┐     ┌──────────────────────────────────────┐
│  KITTY / VXStation (Dell local)     │     │  VYRDx Droplet (134.199.227.138)     │
│  Tailscale: 100.75.146.24           │     │  Tailscale: 100.107.27.53             │
│                                     │     │                                      │
│  ROLE: OBSERVER / CONTROL PLANE     │     │  ROLE: CLOUD RUNTIME / EXECUTION     │
│  MODE: READ-ONLY toward cloud       │     │  MODE: SELF-CONTAINED                │
│                                     │     │                                      │
│  server/vyrdx-relay.ts              │     │  apps/kitty-boundary-gateway/        │
│    Port: 100.75.146.24:7801         │◄────│    Port: 100.107.27.53:7890          │
│    Binds: Tailscale ONLY            │     │    Binds: Tailscale ONLY             │
│    Allowed callers: 100.107.27.53   │     │    Allowed callers: 100.75.146.24    │
│                                     │     │    Auth: Bearer KITTY_BOUNDARY_TOKEN │
│  server/cloud-monitor.ts            │─────►                                     │
│    Port: 127.0.0.1:7802             │     │  Internal services (127.0.0.1 only): │
│    Polls boundary gateway           │     │    7810 VYRDx API                    │
│    Caches cloud state locally       │     │    8080 VYRDx Launch                 │
│                                     │     │    7800 VXStation                    │
└─────────────────────────────────────┘     │    7822 VYRDen Gateway               │
                                            │    7821 Consolab                     │
                                            │    7850 Vault                        │
                                            │    7830 Monitor                      │
                                            │    3100 Airoom                       │
                                            │    4097 SSH Pilot                    │
                                            │    7840 MCP Connector                │
                                            │    7860 DO Room                      │
                                            │    7870 Audit Room                   │
                                            │    7811-7815 Node Bridges            │
                                            └──────────────────────────────────────┘
```

## Boundary Laws (IMMUTABLE)

1. **VXStation (KITTY) is a READ-ONLY observer of cloud runtime.**
   - KITTY may poll status, read market signals, view engines and audit logs.
   - KITTY may NOT send execution commands to VYRDx services.
   - KITTY may NOT modify cloud service configs remotely.

2. **VYRDx Droplet is self-contained.**
   - All services bind to `127.0.0.1` only.
   - Only nginx (port 80) and cloudflared tunnel are publicly reachable.
   - The boundary gateway binds to Tailscale IP `100.107.27.53:7890` only.

3. **All KITTY→Cloud communication goes via Tailscale only.**
   - Never over public internet. Never via Cloudflare tunnel.
   - Token: `KITTY_BOUNDARY_TOKEN` (stored in `/etc/vyrdx/boundary.env` on droplet, `/home/t79/.cloudflared/kitty-boundary.env` locally).

4. **No rogue Cloudflare tunnels from local machine.**
   - Services `vyrden-airoom-cutover-tunnel` and `cloudflared-vyrden` are DISABLED.
   - vyrden.com routes exclusively through droplet cloudflared (tunnel `24829a2d`).
   - Re-enabling these tunnels violates the boundary and splits vyrden.com traffic.

5. **VXStation relay (port 7801) binds to Tailscale only.**
   - `VYRDX_RELAY_HOST=100.75.146.24` — never `0.0.0.0`.
   - Only `100.107.27.53` (droplet) and `127.0.0.1` may call the relay.

## Traffic Flows

### KITTY monitoring cloud (allowed):
```
KITTY:7802 → [cloud-monitor.ts] → Tailscale → 100.107.27.53:7890
             [boundary-gateway] checks IP + token → probes 127.0.0.1 services → returns JSON
```

### VYRDx reading KITTY state (allowed):
```
Droplet → Tailscale → 100.75.146.24:7801 [vyrdx-relay.ts]
         IP check: only 100.107.27.53 allowed → returns read-only state JSON
```

### Public traffic to vyrden.com (allowed):
```
Internet → Cloudflare → tunnel 24829a2d → droplet nginx:80 → 7822/3100
```

### Public traffic to vyrdx.vyrdon.com (allowed):
```
Internet → Cloudflare → tunnel 24829a2d → droplet nginx:80 → 8080
```

### Any direct cloud API access from KITTY (FORBIDDEN):
```
KITTY → 134.199.227.138:7810  ← BLOCKED (not on Tailscale path)
KITTY → cloudflare → vyrden.com ← ROGUE TUNNEL DISABLED
```

## Key Files

| File | Purpose |
|------|---------|
| `/opt/vyrdx/apps/kitty-boundary-gateway/server.js` | Droplet: Tailscale-only read-only gateway for KITTY |
| `/etc/systemd/system/vyrdon-kitty-boundary.service` | Droplet: systemd for boundary gateway |
| `/etc/vyrdx/boundary.env` | Droplet: boundary token (chmod 600) |
| `KITTY/server/cloud-monitor.ts` | Local: polls boundary gateway, serves 127.0.0.1:7802 |
| `KITTY/server/vyrdx-relay.ts` | Local: Tailscale-only state relay (100.75.146.24:7801) |
| `/home/t79/.cloudflared/kitty-boundary.env` | Local: boundary token (chmod 600) |

## Disabled (Do Not Re-enable)

- `~/.config/systemd/user/vyrden-airoom-cutover-tunnel.service` — DISABLED
- `~/.config/systemd/user/cloudflared-vyrden.service` — DISABLED
- CF tunnel `6806749e` (vyrden-airoom) — should stay disconnected from this machine
- CF tunnel `47fd0902` (vyrden-airoom-cutover) — should stay disconnected from this machine
