# Kitty Handoff

This handoff is for moving to the next project without losing Kitty context.

## Done

- Bridge Layer implemented and wired into command routing.
- MCP Linux Admin lane added for real ON/OFF service control.
- MCP Time/Calendar lane added for AI_ROOM central state control.
- Station manual and live station map command added.
- Command bus supports capability-based bridge routing via `vxstation.bridge.*`.
- Policy blocks module-level node pinning (`preferred_node_id` from module source).
- Node registry blocks runtime capability self-elevation.
- Heartbeat and handshake controls added for remote nodes.
- Docs and compliance map updated for the bridge layer.
- Tests added for bridge behavior and command bus bridge path.

## Key Files

- `bridge/node.types.ts`
- `bridge/node.registry.ts`
- `bridge/node.capabilities.ts`
- `bridge/bridge.request.ts`
- `bridge/bridge.policy.ts`
- `bridge/bridge.resolver.ts`
- `bridge/node.handshake.ts`
- `bridge/node.heartbeat.ts`
- `dispatch/hyper-bridge.dispatcher.ts`
- `bin/mcp-linux-admin.py`
- `bin/mcp-linux-admin-up.sh`
- `bin/mcp-linux-admin-status.sh`
- `bin/mcp-linux-admin-down.sh`
- `bin/mcp-time-calendar-agent.py`
- `bin/mcp-time-calendar-up.sh`
- `bin/mcp-time-calendar-status.sh`
- `bin/mcp-time-calendar-down.sh`
- `command-bus/command.dispatcher.ts`
- `command-bus/command.bus.ts`
- `tests/bridge.test.ts`
- `tests/command-bus.test.ts`
- `docs/VYRDON_VYRDX_STATION_MANUAL.md`
- `docs/STATION_EXECUTION_PLAN.md`
- `docs/mcp-time-calendar-lane.md`
- `bin/station-map.py`

## Optional Next (Not Required to Close Kitty)

1. Bridge node bootstrap loader from a locked config file.
2. Terminal radar panel for live bridge health/trust/capability state.
3. Signed node identity material for production-grade handshake rotation.

## Closure Statement

Kitty is stable for handoff:
- Command integrity is enforced.
- Evidence discipline is enforced.
- Bridge routing is controlled and non-sovereign.
- Execution authority remains outside Kitty.
