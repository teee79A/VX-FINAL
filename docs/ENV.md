<!-- AUTO-GENERATED from deploy/.env.example -->
<!-- Last updated: 2026-04-16 | Source: update-docs skill -->

# Environment Variables

## Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VXSTATION_PORT` | No | `7800` | VXSTATION Fastify server port |
| `VXSTATION_HOST` | No | `0.0.0.0` | Server bind address |
| `NODE_ENV` | No | `development` | `production` for deploy |

## Paths

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KITTY_ROOT` | Yes | — | Base path for source tree (e.g. `/app` in Docker) |
| `VYRDX_ROOT` | No | `/opt/vyrdx` | VYRDX runtime root |
| `VYRDOX_CORE_BASE` | No | `/opt/vyrdx/core` | Bridge module state file base path |

## Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password (never commit) |
| `DATABASE_URL` | Yes | — | Runtime PostgreSQL connection string used by payment writes: `postgresql://vyrdon:<pass>@host:5432/vyrdon` |
| `POSTGRES_URL` | No | — | Legacy/deploy helper connection string. The Node runtime reads `DATABASE_URL`. |

## CRM Dispatcher

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRM_DISPATCHER_URL` | Yes (CRM launch) | — | CRM dispatcher endpoint. Missing value returns `INCOMPLETE_INTEGRATION_CONFIG`. |
| `CRM_DISPATCHER_TOKEN` | Yes (CRM launch) | — | CRM dispatcher auth token. Never print or commit. |

## Cache

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://redis:6379` | Redis connection URL |

## Evidence

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KITTY_HASH_HEAD` | No | `<KITTY_ROOT>/evidence/journal/command_bus.hash.head` | Hash chain head file |
| `EVIDENCE_JOURNAL_DIR` | No | `<KITTY_ROOT>/evidence/journal` | JSONL evidence directory |

## Attestation

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ATTESTATION_MODE` | No | `STRICT` | `STRICT` or `DEGRADED_READONLY` |
| `ATTESTATION_DEGRADED_TTL_SECONDS` | No | `86400` | Degraded mode token TTL |
| `ATTESTATION_TOKEN_PATH` | No | `/opt/vyrdx/tokens/attest.token` | Token file location |
| `ATTESTATION_PUBKEY_PATH` | No | `/opt/vyrdx/secure/asus_authority.pub` | Public key for verification |
| `ATTESTATION_TOKEN_MINUTES` | No | `20` | Token validity window |

## DigitalOcean

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DO_REGISTRY` | Yes (deploy) | — | Container registry URL |
| `DO_DROPLET_IP` | Yes (deploy) | — | Target droplet IP |
| `DO_SSH_KEY` | No | `~/.ssh/id_ed25519` | SSH key for deploy |

## Cloudflare

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CF_TUNNEL_TOKEN` | Yes (tunnel) | — | Cloudflare Tunnel auth token |
| `CF_TUNNEL_NAME` | No | `vyrdx-vyrdon` | Tunnel name |

## Arbitrum

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ARBITRUM_RPC_URL` | No | `https://arb1.arbitrum.io/rpc` | Arbitrum L2 RPC endpoint |
| `ARBITRUM_CHAIN_ID` | No | `42161` | Arbitrum One chain ID |

## ConsoLab

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONSOLAB_URL` | No | `https://consollab.vyrdon.com` | Authority plane URL |
| `CONSOLAB_PORT` | No | `7900` | ConsoLab server port |
| `CONSOLAB_ROOT` | No | — | ConsoLab key/cert base path |
| `CONSOLAB_SIGNING_KEY_PATH` | Yes (prod) | — | Ed25519 signing key |
| `ASUS_AUTHORITY_HOST` | No | `100.127.85.101` | ASUS node Tailscale IP |
| `ASUS_AUTHORITY_PORT` | No | `2222` | ASUS SSH port |
