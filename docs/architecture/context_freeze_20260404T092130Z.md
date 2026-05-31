# VXSTATION Central Brain Context Freeze

Frozen at: 2026-04-04T09:21:30+00:00
Root: /opt/kitty

## Why this freeze exists

This freeze records the corrected stop point after reviewing:

- the writable Kitty core at `/opt/kitty`
- the older room-based mirror at `/home/t79/vscode/codex/kitty/vxstation`
- the `VYRDX` runtime and API Factory metadata under `/home/t79/VYRDON/VYRDX`

The user-locked priority remains:

1. finalize `VXSTATION`
2. complete `SZH_CENTRAL_BRAIN`
3. close API gateway/server/tunnel and API Factory runtime/control integration
4. only then return to `Termius`

## Locked system identity

- `ASUS` = authority machine
- `VXSTATION` = local Kitty control surface
- `VYRDX` = cloud/runtime execution boundary
- `VYRDOX` = hidden intelligence module

Canonical room contract:

1. `OPERATION_ROOM`
2. `ARCHIVING_ROOM`
3. `FEEDBACK_CLOUD_VYRDX_ROOM`
4. `SZH_CENTRAL_BRAIN`
5. `VYRDOX_HIDDEN_ROOT`

Termius maintenance rooms are separate and remain locked to:

- `ai_room`
- `vyrdon`
- `media_room`

## Newly locked delivery requirements

The target station is a live control surface, not just a passing TypeScript core.

The required finish state is:

- Kitty behaves like high-tech TV panel surfaces
- room surfaces react live in real time
- `SZH_CENTRAL_BRAIN` is fully wired to those rooms
- room and brain flows are configured through MCP connectors
- Operation Room noisy traffic goes through one control path
- VXSTATION exposes API gateway, server, and tunnel posture through that control path

## What is confirmed built in the writable core

### Core health

`/opt/kitty` runs clean on:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run ci:mandatory`

### Provider bridge

The writable core contains a real provider bridge in:

- `command-bus/brain.gateway.ts`

Confirmed behavior:

- handles `vxstation.brain.*`
- resolves `vllm` or `openrouter`
- fails closed when provider config is missing
- performs OpenAI-compatible `chat/completions` calls
- returns evidence refs into the command flow

### Local bridge baseline

The writable core contains:

- capability-based command routing through `bridge/*`
- bridge dispatch through `dispatch/hyper-bridge.dispatcher.ts`
- local MCP agents for linux admin, voice, and time/calendar

Current bound bridge nodes in `bridge/nodes.json`:

- `mcp-linux-admin-local`
- `mcp-voice-local`
- `mcp-time-calendar-ai-room`

That is only `3` currently declared local bridge nodes.

## What is confirmed in the older room-based mirror

The older mirror still carries the more complete intended live-topology design.

### Panel topology

`shell/layouts/zellij/vxstation.kdl` defines these tabs:

- `VXSTATION`
- `Radar-Glass`
- `Operation-Room`
- `Archiving-Room`
- `Feedback-Cloud`
- `SZH-SSH-Kitten`
- `Termius-Control`
- `Audio-Substrate`
- `Central-Brain-Host`

This is the strongest proof that the intended station surface was a live multi-panel layout.

### Central-brain control plane

`szhr/brain/orchestrator/control_plane/control_plane.manifest.json` confirms these members:

- `gateway`
- `tunnel_fabric`
- `nervous_system`
- `ssh_kitten`
- `termius_bridge`

`SZH_CENTRAL_BRAIN_ARCHITECTURE.md` explicitly states:

- nervous system = tunnel fabric
- gateway = heart
- logic layer = MCP + memory + RAG + account intelligence

### Private gateway and tunnel fabric

The older mirror contains:

- `szhr/routing/private_gateway/gateway_server.py`
- `szhr/routing/private_gateway/gateway.manifest.json`
- `szhr/routing/tunnel_fabric/tunnel.manifest.json`

Confirmed topology:

- private gateway binds to `127.0.0.1:46080`
- tunnel fabric targets the private gateway
- transport is intended to stay private via SSH local forwards

## Confirmed Operation Room and nervous-system counts

From `room/operation_room/power_room/stack_manifest.json`:

- `15` MCP integrations
- `15` engines
- `15` adapters
- `15` local server slots
- `15` hooks

That is `75` active selected-local stack lanes.

From `szhr/routing/tunnel_fabric/tunnel.manifest.json`:

- reserved port window = `10001-10150`
- reserved capacity total = `150`
- reserved capacity per group = `30`
- active slot total = `75`

Important correction:

- the reviewed code does **not** prove `150` active engines
- it proves `150` reserved nervous-system slots and `75` active stack-derived lanes

## Confirmed drift and closure gaps

### 1. Writable core does not yet match the live room topology

The writable core is still a modular implementation and does not yet physically expose the full room/panel/gateway/tunnel design found in the older mirror.

### 2. Live panel surfaces are not installed in the writable tree

These exist but are empty:

- `/opt/kitty/apps/api`
- `/opt/kitty/apps/admin`
- `/opt/kitty/apps/web`

`packages/` and `infra/` also do not yet provide a live room UI or server surface.

### 3. Gateway/tunnel control plane is not yet ported into the writable tree

The older mirror contains the authenticated loopback private gateway and tunnel-fabric nervous system. The writable tree currently contains only the newer command bus/bridge baseline.

### 4. API Factory source drift remains unresolved

`/home/t79/VYRDON/VYRDX/services/service_definitions.py` still points at:

- `code/python/services/api_factory.py`

That source file is missing. Only compiled cache remains.

### 5. Documented cloud runtime root is absent on this machine

The documented `VYRDX` runtime root:

- `/srv/vyrdx/current`

is not present on this machine right now.

## Best current interpretation

VXSTATION is partially built in two different forms:

- a newer writable modular core
- an older read-only room-based mirror with the richer live topology

The finishing job is to merge those into one delivered writable station:

- port live room panels into the writable tree
- port or rebuild the private gateway/server and tunnel-fabric nervous system there
- expand MCP node/connector coverage beyond the current 3-node baseline
- wire `SZH_CENTRAL_BRAIN` to the canonical rooms as live surfaces
- close the API Factory/runtime bridge drift

## If context is lost

Start here:

1. `/opt/kitty/docs/architecture/context_freeze_latest.md`
2. `/opt/kitty/docs/contracts/vxstation-room-contract.md`
3. `/opt/kitty/docs/architecture/vxstation-room-service-map.md`
4. `/home/t79/VYRDON/VYRDX/runtime/state/api_factory/context_freeze_latest.md`

Then reopen these anchors:

- `/opt/kitty/bridge/nodes.json`
- `/opt/kitty/command-bus/brain.gateway.ts`
- `/opt/kitty/bin/kitty-up.sh`
- `/home/t79/vscode/codex/kitty/vxstation/shell/layouts/zellij/vxstation.kdl`
- `/home/t79/vscode/codex/kitty/vxstation/room/operation_room/power_room/stack_manifest.json`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/brain/orchestrator/control_plane/control_plane.manifest.json`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/routing/private_gateway/gateway.manifest.json`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/routing/tunnel_fabric/tunnel.manifest.json`
- `/home/t79/VYRDON/VYRDX/services/service_manifest.json`
- `/home/t79/VYRDON/VYRDX/services/service_definitions.py`
