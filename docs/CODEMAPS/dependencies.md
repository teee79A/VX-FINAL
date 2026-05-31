<!-- Generated: 2026-04-17 | Files scanned: 142 | Token estimate: ~400 -->

# Dependencies Codemap

## Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `fastify` | latest | HTTP server framework |
| `@fastify/websocket` | v11+ | WebSocket support (raw WS API) |
| `tsx` | latest | TypeScript execution without build |
| `@aiondadotcom/mcp-ssh` | latest | MCP SSH connector |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 5.x | Compiler (strict mode) |
| `vitest` | latest | Test framework (142 tests) |
| `eslint` | latest | Linter |
| `@typescript-eslint/*` | latest | TS-aware ESLint rules |
| `@types/node` | latest | Node.js type definitions |
| `@types/ws` | latest | WebSocket type definitions |
| `chai` | latest | Assertion library (legacy) |

## External Services

| Service | Connection | Used By |
|---------|-----------|---------|
| PostgreSQL 17 | `DATABASE_URL` | vxstation runtime payment writes; docker-compose also keeps `POSTGRES_URL` as a legacy helper |
| Redis 7 | `REDIS_URL` | vxstation (docker-compose) |
| Arbitrum L2 | `ARBITRUM_RPC_URL` | GasOptimizer engine |
| ASUS Authority | Tailscale `100.127.85.101:2222` | Attestation token refresh |
| Cloudflare Tunnel | `CF_TUNNEL_TOKEN` | Public ingress |
| DigitalOcean Registry | `DO_REGISTRY` | Container image storage |

## Internal Runtime (/opt/vyrdx — JS, read-only)

| Module | State File | Bridge Wrapper |
|--------|-----------|---------------|
| analytics | `core/state/analytics.json` | `vyrdx-bridge/modules/analytics.bridge.ts` |
| hardware | `core/state/hardware.json` | `vyrdx-bridge/modules/hardware.bridge.ts` |
| health | `core/state/health.json` | `vyrdx-bridge/modules/health.bridge.ts` |
| market | `core/state/market.json` | `vyrdx-bridge/modules/market.bridge.ts` |
| opportunity | `core/state/opportunity.json` | `vyrdx-bridge/modules/opportunity.bridge.ts` |
| security | `core/state/security.json` | `vyrdx-bridge/modules/security.bridge.ts` |
| supervision | `core/state/supervision.json` | `vyrdx-bridge/modules/supervision.bridge.ts` |
