<!-- Generated: 2026-04-17 | Files scanned: 145 | Token estimate: ~1000 -->

# Architecture Codemap

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VXSTATION (KITTY)                        │
│                     Fastify :7800 + WebSocket                   │
├─────────────┬───────────────┬───────────────┬───────────────────┤
│  server/    │  consolab/    │  deploy/      │  vyrdx-bridge/    │
│  (runtime)  │  (authority)  │  (infra)      │  (runtime wrap)   │
├─────────────┴───────────────┴───────────────┴───────────────────┤
│                        ENGINES/ (88 classes)                    │
│  CEO: 10 engine layers + 10 server layers + conductor           │
│  Domains: security, engineering, infra, financial, director,    │
│           server, interconnect, governance                      │
├─────────────────────────────────────────────────────────────────┤
│  command-bus/     │  evidence/       │  bridge/                 │
│  (14 files,       │  (hash chain,    │  (node topology,         │
│   1317 lines)     │   JSONL sinks)   │   trust, heartbeat)      │
├───────────────────┴──────────────────┴──────────────────────────┤
│  shared/ (types) │ policy/ (rules) │ shell/ │ registry/         │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────┐                    ┌──────────────────┐
│   /opt/vyrdx    │                    │   ASUS ConsoLab  │
│   (JS runtime)  │◄── state files ──►│   (authority)    │
│   DO NOT REWRITE│                    │   Tailscale mesh │
└─────────────────┘                    └──────────────────┘
```

## Module Inventory

| Module | Files | Lines | Role |
|--------|-------|-------|------|
| shared/ | 7 | 132 | Foundation types, error codes, result envelope |
| bridge/ | 11 | 733 | Node topology, trust, handshake, heartbeat |
| policy/ | 5 | 126 | Route, command, capability, terminal policies |
| command-bus/ | 14 | 1317 | Command processing, audit, idempotency, replay |
| evidence/ | 6 | 271 | Hash chain, JSONL sink, atomic writes |
| ENGINES/ | 14 | 4558 | 88 engine classes across 8 domains |
| SZH_CENTRAL_BRAIN/ | 6 | 363 | Central brain runtime, orchestration |
| shell/ | 6 | 493 | Terminal controllers, layouts |
| dispatch/ | 2 | 123 | Command dispatchers |
| wrappers/ | 4 | 108 | Event, result, module, terminal wrappers |
| registry/ | 4 | 90 | Module registry, loader, validator |
| terminal/ | 3 | 59 | Builder, parser, renderer |
| vyrdx-bridge/ | 22 | 1676 | Typed wrappers for /opt/vyrdx JS runtime + remote HTTP bridge |
| server/ | 2 | 518 | Fastify runtime server + VYRDX relay |
| consolab/ | 4 | 614 | Authority plane, key signing, heartbeat |

## Data Flow

```
User Request
    │
    ▼
server/index.ts (Fastify)
    │
    ├──► ENGINES/ceo/conductor.ts   → orchestrate workflow
    │       └──► 10 engine layers   → process domain logic
    │
    ├──► vyrdx-bridge/bridge.ts     → read /opt/vyrdx state files
    │       ├──► 7 module bridges   → typed JSON readers (local mode)
    │       └──► remote-bridge.ts   → HTTP fetch from relay (droplet mode)
    │
    ├──► evidence/hash-chain.ts     → append evidence record
    │       └──► jsonl.sink.ts      → atomic write to journal
    │
    └──► /ws WebSocket              → push telemetry (30s)
```

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Server | `server/index.ts` | Main process — `npm start` |
| Relay | `server/vyrdx-relay.ts` | VYRDX state relay on ASUS (:7801) |
| ConsoLab | `consolab/token-refresh-server.ts` | Authority on :7900 |
| Root | `root.ts` | Legacy station bootstrap |
