# VYRDON / VYRDX Station Manual (Kitty Control Plane)

This manual defines the working station model in plain operator language and strict control terms.

## 1) Station Identity

- `Vyrdon` is the parent system.
- `VYRDX` is the runtime product.
- `Kitty` is the control plane.
- `VXSTATION` is the local root workspace for daily operations, not runtime authority.
- canonical local root path is `/local/VXSTATION` (see `docs/contracts/vxstation-paths.contract.md`).

Kitty is not execution authority.  
Kitty validates, records, and routes.

## 2) Station Law

Non-negotiable:

1. Modules cannot execute.
2. Modules cannot seal.
3. Modules cannot mutate global truth.
4. All actions pass command bus.
5. No direct execution imports.
6. No raw DB access from modules.
7. Evidence-first discipline.
8. 4-table backbone mandatory.

## 3) Station Layers

Control chain:

`Gateway -> Command Bus -> Guards/Layers -> State Store -> Bridge -> Dispatcher -> External Executor`

Boundary law:

- Inside Kitty: validate, decide, record, route.
- Outside Kitty: execute.

## 4) Lanes (Operator View)

Lane map:

- `lane_01_core` doctrine/policy
- `lane_02_runtime` runtime controls
- `lane_03_ops` operations orchestration
- `lane_04_data` memory/rag spine
- `lane_05_archive` evidence archive
- `lane_06_lab` AI room integration
- `lane_07_media` voice/audio/video lanes
- `lane_08_logs` alerts and rejection trails

## 5) Module Model

Modules are workers, never sovereign.

Modules can:

- compute
- observe
- render
- request

Modules cannot:

- execute
- seal
- mutate global truth
- bypass command bus

## 6) Bridge Layer (Current Maturity)

Bridge layer is minimal and policy-controlled.

It provides:

- node registry
- capability-based resolver
- trust policy
- routing-only dispatch
- heartbeat and handshake primitives

It does not provide:

- execution authority
- dynamic load arbitration
- sovereign routing policy

## 7) Real ON/OFF Power Lanes

Current real lanes:

- `MCP Linux Admin` (`/dispatch`) with intent allowlist:
  - `ops.service.start`
  - `ops.service.stop`
  - `ops.service.restart`
  - `ops.service.status`
  - `ops.service.logs`
- `MCP Time/Calendar` (`/dispatch`) with intent allowlist:
  - `time.state.now`
  - `calendar.state.get`
  - `calendar.state.upsert`

Service allowlist:

- `openhands`
- `vllm`

AI_ROOM state authority:

- `/home/t79/AI_ROOM/state/calendar_state.json`

## 8) Secrets and Security

- Secrets must stay in environment or vault, never in source logs.
- Private endpoints only for bridge nodes.
- Token auth is required for external dispatch surfaces.
- No fallback routing unless explicitly declared in policy.
- No evidence -> reject flow.

## 9) Red Zone Policy

Offensive and red-team tools must stay in isolated hidden zone:

- separate runtime boundary
- separate credentials
- single-agent authorization
- deny-by-default for all others
- full evidence trace on each action

## 10) Station Map Command

Live station status command:

```bash
/opt/kitty/bin/station-map.py --pretty
```

Outputs:

- lane online/offline status
- command gate counters
- module inventory
- bridge node health
- service states
- evidence file paths

## 11) Operator Contract

Kitty is stable when:

- command bus controls all mutation paths
- bridge remains routing-only
- evidence remains deterministic and hash-linked
- policy violations fail closed

This manual is the continuation contract for station work.
