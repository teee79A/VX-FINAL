<!-- Generated: 2026-04-17 | Files scanned: 145 | Token estimate: ~800 -->

# Backend Codemap

## VXSTATION Server Routes (port 7800)

```
GET  /health                          → { status, uptime, conductor, bridge }
GET  /api/conductor/topology          → CeoConductor.getTopology()
GET  /api/conductor/workflows         → CeoConductor.listWorkflows()
POST /api/conductor/:workflow         → CeoConductor.executeWorkflow(workflow, payload)
POST /api/conductor/fire/layer        → CeoConductor.fireLayer(layer, payload)
POST /api/conductor/fire/server       → CeoConductor.fireServer(server, payload)
GET  /api/evidence/chain-head         → getCurrentEvidenceHash()
GET  /api/evidence/verify/:hash       → (info only — use evidence layer)
GET  /api/commercial/status           → conductor.fireLayer("commercial")
GET  /api/commercial/market           → bridge.market.{price,volatility,isBreakout}
GET  /api/commercial/revenue          → conductor.executeWorkflow("revenue")
GET  /api/observability/snapshot      → bridge.snapshot()
GET  /api/observability/hardware      → bridge.hardware.{load,memFree,cpuTemp}
GET  /api/observability/security      → bridge.security.{chainOk,severity}
GET  /api/observability/supervision   → bridge.supervision.{divergence,rss,drifting}
GET  /api/observability/services      → bridge.{chainVerifier,feedEngine,attest,rtmp}
GET  /api/observability/analytics     → bridge.analytics.{confidence,mode}
GET  /api/bridge/snapshot             → bridge.snapshot()
GET  /api/bridge/opportunities        → bridge.opportunity.{count,latestConfidence}
GET  /api/bridge/boot                 → bridge.vyrdox.{isDirectiveValid,isLawValid}
WS   /ws                             → live telemetry (10s push, ping/pong, snapshot)
```

## ConsoLab Routes (port 7900)

```
GET  /health                          → { status, uptime, nodeId, nodes }
POST /api/attestation/refresh         → authority.signAttestationToken(nodeId, ...)
POST /api/attestation/verify          → authority.verifyToken(token) + expiry check
GET  /api/attestation/public-key      → authority.getPublicKey()
POST /api/certificates/issue          → authority.issueCertificate(nodeId, pubKey, ...)
POST /api/heartbeat                   → heartbeat.receiveHeartbeat(payload)
GET  /api/heartbeat/status            → heartbeat.getStatus()
POST /api/heartbeat/register          → heartbeat.registerNode(nodeId, role)
```

## VYRDX Relay Routes (port 7801 — ASUS only)

```
GET  /health                          → relay health + state file list
GET  /snapshot                        → all 7 state files merged
GET  /state/:name                     → individual state file (risk-profile, system-health, etc.)
GET  /services                        → systemctl status for vyrdx services
GET  /sha                             → SHA-256 of all state files (integrity check)
```

## Key Backend Files

| File | Lines | Responsibility |
|------|-------|---------------|
| `server/index.ts` | 319 | Main Fastify server, all routes |
| `server/vyrdx-relay.ts` | 199 | VYRDX state relay (ASUS-side) |
| `consolab/token-refresh-server.ts` | 173 | ConsoLab Fastify server |
| `consolab/authority.ts` | 223 | Ed25519 key mgmt, token signing, cert issuance |
| `consolab/heartbeat.ts` | 200 | Node health tracking, missed beat detection |
| `ENGINES/ceo/conductor.ts` | ~250 | Workflow orchestration (7 named workflows) |
| `ENGINES/ceo/index.ts` | ~2650 | 10+10 CEO layer implementations |
| `vyrdx-bridge/bridge.ts` | ~188 | Facade + async factory (local or remote) |
| `vyrdx-bridge/remote-bridge.ts` | ~183 | HTTP-based bridge for droplet |

## Middleware / Guards

```
command-bus/idempotency.guard.ts  → prevents duplicate command execution
command-bus/replay.guard.ts       → blocks replayed commands
command-bus/no-direct-exec.guard.ts → blocks exec-prefixed actions
command-bus/command.security.ts   → sanitizes command inputs
policy/route.policy.ts            → route-level access control
policy/command.policy.ts          → command-level authorization
```

## Dependencies

- **Fastify** — HTTP server + WebSocket
- **@fastify/websocket** — WS support (v11+, raw WebSocket API)
- **tsx** — TypeScript execution without compile step
- **PostgreSQL** — primary data store (via docker-compose)
- **Redis** — cache layer (via docker-compose)
