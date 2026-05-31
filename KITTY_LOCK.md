# KITTY LOCK (Finalized Baseline)

Date: 2026-03-28
Scope: Kitty control plane hardening + Bridge Layer

## Locked Laws

1. Modules cannot execute.
2. Modules cannot seal.
3. Modules cannot mutate global truth.
4. All actions route through command bus.
5. No direct execution imports.
6. No raw DB access from modules.
7. Evidence-first discipline.
8. 4-table backbone mandatory.

## Control Boundary

- Kitty validates, decides, records, and dispatches.
- Kitty does not execute external runtime actions directly.
- Execution authority is external to Kitty.

## Completed in This Baseline

- Command bus idempotency and replay guard.
- Decision snapshots + hash-linked evidence writes.
- Mandatory CI gates (typecheck, lint, tests, security rules).
- Immutable evidence sink interface.
- Bridge Layer:
  - Node registry
  - Capability-based bridge resolver
  - Bridge policy guardrails
  - Routing-only bridge dispatcher
  - Node heartbeat + handshake
- MCP Linux Admin lane:
  - real `/dispatch` endpoint for service power/status/logs
  - service allowlist for `openhands` and `vllm`
- MCP Time/Calendar lane:
  - real `/dispatch` endpoint for AI_ROOM central time/calendar state
  - state authority at `/home/t79/AI_ROOM/state/calendar_state.json`
- Station layer visibility:
  - live station map command (`bin/station-map.py`)
  - VYRDON/VYRDX station manual (`docs/VYRDON_VYRDX_STATION_MANUAL.md`)

## Hard Guardrails

- Modules cannot pin remote node routes.
- Node capability elevation is blocked at runtime.
- Bridge is routing only, not execution authority.
- Evidence failures are fail-closed.

## Verification Snapshot

- `npm run ci:mandatory` passed.
- Test suite passed with bridge coverage included.
