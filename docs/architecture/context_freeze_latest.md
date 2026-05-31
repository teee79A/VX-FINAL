# VXSTATION Central Brain Context Freeze

Frozen at: 2026-04-04T09:21:30+00:00
Root: /opt/kitty
Latest snapshot: `context_freeze_20260404T092130Z.md`

## Priority

Do not start with the terminal maintenance surface.

Current priority is:

1. finalize `VXSTATION`
2. complete `SZH_CENTRAL_BRAIN`
3. close API factory and runtime/control integration
4. only then return to `terminal`

## Locked system roles

- `ASUS` = authority machine
- `VXSTATION` = local Kitty control surface
- `VYRDX` = cloud/runtime boundary
- `VYRDOX` = hidden intelligence module

## Locked room contract

1. `OPERATION_ROOM`
2. `ARCHIVING_ROOM`
3. `FEEDBACK_CLOUD_VYRDX_ROOM`
4. `SZH_CENTRAL_BRAIN`
5. `VYRDOX_HIDDEN_ROOT`

Terminal maintenance rooms:

- `ai_room`
- `vyrdon`
- `media_room`

## Confirmed built

- Kitty tests/lint/typecheck/mandatory CI pass in `/opt/kitty`
- provider bridge exists in `command-bus/brain.gateway.ts`
- startup/provider boot path exists in `bin/kitty-up.sh` and `docker/compose.yml`
- older explicit `SZH` control-plane design exists in the read-only mirror under `/home/t79/vscode/codex/kitty/vxstation/.../control_plane`
- `security.api_factory` is declared in VYRDX runtime service metadata

## Locked live-surface requirements

The current delivery target is not a static terminal shell.

It must finish as:

- high-tech Kitty TV panels
- live/reactive room surfaces
- `SZH_CENTRAL_BRAIN` fully wired to those rooms
- room and brain configuration moved through MCP connectors
- one-path control flow for noisy Operation Room traffic
- API gateway + server + tunnel posture inside the VXSTATION control path

The terminal maintenance surface is explicitly deferred until this is closed.

## Confirmed old topology in the mirror

The read-only mirror under `/home/t79/vscode/codex/kitty/vxstation` still holds the more complete intended topology.

Confirmed there:

- `shell/layouts/zellij/vxstation.kdl` defines multi-tab panel surfaces for:
  - `VXSTATION`
  - `Radar-Glass`
  - `Operation-Room`
  - `Archiving-Room`
  - `Feedback-Cloud`
  - `SZH-SSH-Kitten`
  - `Terminal-Control`
  - `Audio-Substrate`
  - `Central-Brain-Host`
- `Central-Brain-Host` is designed to run `claude mcp serve` plus live MCP status polling
- `SZH` control plane members are explicitly wired in `control_plane.manifest.json`
- `private_gateway` is a loopback-only authenticated control heart on `127.0.0.1:46080`
- `tunnel_fabric` is the nervous system and targets the private gateway over SSH local forwards

## Confirmed stack and nervous-system counts

From the older room-based mirror:

- `room/operation_room/power_room/stack_manifest.json` contains:
  - 15 MCP integrations
  - 15 engines
  - 15 adapters
  - 15 server slots
  - 15 hooks
- that is `75` active selected-local stack lanes
- `szhr/routing/tunnel_fabric/tunnel.manifest.json` reserves port window `10001-10150`
- reserved nervous-system capacity is `150`
- active slot total in the generated tunnel manifest is `75`

Important correction recorded by the older architecture itself:

- the design does **not** claim `150` active engines today
- it claims `150` reserved nervous-system slots and `75` active stack-derived lanes

## Current writable-core posture

The writable core at `/opt/kitty` does not yet carry that full live topology.

Confirmed current posture:

- `bridge/nodes.json` contains only `3` local bridge nodes
- `command-bus/brain.gateway.ts` exists and is functional
- the capability bridge/dispatcher exists
- `apps/api` is empty
- `apps/admin` is empty
- `apps/web` is empty
- `apps/`, `packages/`, and `infra/` do not yet carry the live panel, gateway server, or tunnel-fabric surfaces from the older mirror

This is the main closure gap.

## Confirmed gaps

- `/opt/kitty/apps/api` is empty
- `/opt/kitty/apps/admin` is empty
- `/opt/kitty/apps/web` is empty
- writable core currently exposes only `3` bridge nodes, not the older `75` active-lane nervous system
- old private gateway and tunnel fabric live only in the read-only mirror, not the writable core
- current room map overstates `OPERATION_ROOM` and `SZH_CENTRAL_BRAIN` readiness if judged against the live-panel target
- documented cloud runtime root `/srv/vyrdx/current` is missing on this machine
- `services/service_definitions.py` still points at `code/python/services/api_factory.py`, but that source file is missing
- writable Kitty core is modular; older room-based structure lives in read-only mirror

## Recovery anchors

- `/opt/kitty/docs/contracts/vxstation-room-contract.md`
- `/opt/kitty/docs/architecture/vxstation-room-service-map.md`
- `/opt/kitty/docs/architecture/vxstation-room-port-inventory.md`
- `/opt/kitty/data/vxstation_room_service_map.json`
- `/home/t79/VYRDON/VYRDX/runtime/state/api_factory/context_freeze_latest.md`
- `/opt/kitty/command-bus/brain.gateway.ts`
- `/opt/kitty/bridge/nodes.json`
- `/opt/kitty/bridge/topology.manifest.json`
- `/opt/kitty/data/szh_central_brain/engine_catalog.json`
- `/opt/kitty/data/szh_central_brain/mcp_nervous_system.json`
- `/home/t79/VYRDON/VYRDX/services/service_manifest.json`
- `/home/t79/vscode/codex/kitty/vxstation/shell/layouts/zellij/vxstation.kdl`
- `/home/t79/vscode/codex/kitty/vxstation/room/operation_room/power_room/stack_manifest.json`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/brain/orchestrator/control_plane/SZH_CENTRAL_BRAIN_ARCHITECTURE.md`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/routing/private_gateway/gateway.manifest.json`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/routing/tunnel_fabric/tunnel.manifest.json`

## Block 3 - TERMINUSE Dropped

`TERMINUSE` is no longer a valid top-level or internal domain in the current KITTY model.

Seal only the roots that actually exist on disk today:

```text
/opt/kitty/
├── OPERATION_ROOM/
├── ARCHIVING_ROOM/
├── FEEDBACK_CLOUD_VYRDX_ROOM/
├── SZH_CENTRAL_BRAIN/
├── VYRDOX_HIDDEN_ROOT/
├── terminal/                # operator shell, ssh imports, admin entry
├── gateway/                 # single public/control entry
├── shell/
├── docs/
└── infra/
```

Rules:

- `KITTY` is the only real root
- `VXSTATION` remains the internal system identity inside `KITTY`
- `terminal` replaces the old `Termius` naming
- `SZH_CENTRAL_BRAIN` owns orchestration, policy, and engine coordination
- `terminal` owns operator shell and ssh-facing maintenance surfaces
- no declared live root without a matching directory on disk

Deferred, not sealed as live roots today:

- `AI_ROOM`
- `VYRDX`
- `connector`
- `workflow_engine_manager`
- `servers`

Do not create `/TERMINUSE`.
Do not create `SZH_CENTRAL_BRAIN/terminuse`.
