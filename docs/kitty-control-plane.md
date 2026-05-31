# Kitty Terminal Control Plane (Canonical)

```text
Kitty (Terminal Control Plane)
│
├── Command Bus (ONLY authority)
│
├── Command Gateway
├── Validation Layer
├── Policy Layer
├── Evidence Layer
│
├── State Store (4-table backbone)
│
├── Dispatch Layer
│
└── External Executors (NON-KITTY)
```

## Layered Architecture (Final Terms)

### 4.1 Command Entry

- Command Gateway accepts input from modules/terminal.
- Command Gateway normalizes command envelope.
- Command Gateway does not execute.

### 4.2 Control Core

- Command Bus is the single authority in Kitty.
- Command Bus enforces Kitty law.
- Command Bus routes commands and writes evidence.

### 4.3 Enforcement Layers

- Validation Layer
- Policy Layer
- Replay Guard
- Idempotency Guard

All enforcement components are deterministic, non-executing, and side-effect free except evidence writes.

Bridge controls:

- Bridge Resolver chooses nodes by required capabilities.
- Bridge Policy blocks route pinning from modules and trust-level violations.
- Node Registry is descriptive only and cannot self-elevate capabilities.
- Bridge Dispatcher performs real HTTP dispatch to approved external nodes.

### 4.4 State Layer

- State Store is the authoritative persistence boundary (`commands`, `command_locks`, `nonces`, `evidence`).
- State Store is not an ORM abstraction.

### 4.5 Dispatch Boundary

- Dispatch Layer emits execution intent only.
- Dispatch Layer does not execute.
- Bridge Dispatcher routes to external nodes without execution authority.

### 4.6 Outside Kitty

- Execution Plane (workers/runtimes/containers) is external.
- Kitty never crosses into execution authority.

## Terminal-Specific Structure

```text
Terminal Interface
│
├── Input Parser
├── Command Builder
├── Command Gateway
│
└── Output Renderer
```

## Strict Naming Taxonomy

Allowed suffixes:

- `*Gateway` -> boundary entry
- `*Bus` -> authority
- `*Layer` -> transformation/enforcement
- `*Guard` -> protection
- `*Store` -> persistence
- `*Dispatcher` -> routing outward
- `*Processor` -> deterministic logic
- `*Controller` -> coordination (rare in Kitty)

Discouraged/forbidden naming:

- `engine`
- `adapter`
- `hook`
- `manager`
- `helper`
- `util`
- `misc`
- `core`
- `service` (unless externally exposed)

Canonical control order:

`Gateway -> Bus -> Guards -> Layers -> Store -> Dispatcher`

`Entry -> Authority -> Protection -> Enforcement -> Truth -> Exit`

## Full Architecture Diagram

```mermaid
flowchart TD
    T[Terminal Interface]

    T --> P[Input Parser]
    P --> B[Command Builder]
    B --> G[Command Gateway]

    G --> CB[Command Bus]

    CB --> V[Validation Layer]
    CB --> PG[Policy Layer]
    CB --> RG[Replay Guard]
    CB --> IG[Idempotency Guard]

    CB --> E[Evidence Layer]
    CB --> S[State Store]
    CB --> BR[Bridge Resolver]
    BR --> BP[Bridge Policy]

    CB --> D[Dispatch Layer]
    D --> HB[Bridge Dispatcher]

    HB --> X[Execution Plane (External)]

    X --> CB
```

## Code Mapping

- Command Bus (ONLY authority)
  - `command-bus/command.bus.ts`
- Command Gateway
  - `command-bus/gateway.ts`
  - `shell/terminal.shell.ts` (`gateOperatorCommand`)
- Validation Layer
  - `command-bus/validation.layer.ts`
  - `command-bus/idempotency.guard.ts`
  - `command-bus/replay.guard.ts`
- Policy Layer
  - `command-bus/policy.layer.ts`
  - `command-bus/no-direct-exec.guard.ts`
- Evidence Layer
  - `evidence/evidence.layer.ts`
  - `evidence/evidence.writer.ts`
  - `evidence/hash-chain.ts`
  - `evidence/jsonl.sink.ts`
  - `evidence/immutable.sink.interface.ts`
- State Store (4-table backbone)
  - `state/store.ts`
  - tables: `commands`, `command_locks`, `nonces`, `evidence`
- Bridge Layer
  - `bridge/node.types.ts`
  - `bridge/node.registry.ts`
  - `bridge/node.capabilities.ts`
  - `bridge/node.bootstrap.ts`
  - `bridge/nodes.json`
  - `bridge/bridge.request.ts`
  - `bridge/bridge.policy.ts`
  - `bridge/bridge.resolver.ts`
  - `bridge/node.handshake.ts`
  - `bridge/node.heartbeat.ts`
- Dispatch Layer
  - `dispatch/dispatcher.ts`
  - `dispatch/hyper-bridge.dispatcher.ts`
  - `command-bus/command.dispatcher.ts`
- External MCP Linux Admin lane
  - `bin/mcp-linux-admin.py`
  - `bin/mcp-linux-admin-up.sh`
  - `bin/mcp-linux-admin-status.sh`
  - `bin/mcp-linux-admin-down.sh`
- Execution Plane (External / NON-KITTY)
  - `command-bus/brain.gateway.ts` (OpenRouter/vLLM call-outs)
  - `vyrdx.boundary.request` target path

## Reference File Structure

```text
kitty/
├── command-bus/
│   ├── command.bus.ts
│   ├── gateway.ts
│   ├── replay.guard.ts
│   ├── idempotency.guard.ts
│   ├── validation.layer.ts
│   └── policy.layer.ts
│
├── bridge/
│   ├── node.types.ts
│   ├── node.registry.ts
│   ├── node.capabilities.ts
│   ├── bridge.request.ts
│   ├── bridge.policy.ts
│   ├── bridge.resolver.ts
│   ├── node.handshake.ts
│   └── node.heartbeat.ts
│
├── evidence/
│   └── evidence.layer.ts
│
├── state/
│   └── store.ts
│
├── dispatch/
│   ├── dispatcher.ts
│   └── hyper-bridge.dispatcher.ts
│
├── terminal/
│   ├── parser.ts
│   ├── builder.ts
│   └── renderer.ts
│
└── modules/
    ├── *.module.ts
```

## Enforcement Notes

- Kitty validates, decides, records, and dispatches.
- Kitty modules do not execute directly.
- Modules cannot pin remote node routes.
- Execution authority remains outside Kitty.
