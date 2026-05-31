# VXSTATION Room Service Map

This map binds the canonical five-room contract to the current Kitty modular core.

## Room Map

### `OPERATION_ROOM`

- status: `live_mapping`
- role: live control surface, operator execution room, and real-time TV-panel surface
- current Kitty surfaces:
  - `bin/vxstation_dashboard.py`
  - `bin/vxstation_radar.py`
  - `bin/kitty-operation-room.sh`
  - `shell/layouts/zellij/operation_room.kdl`
  - `room/operation_room/*`
  - `command-bus/*`
  - `dispatch/*`
  - `bridge/*`
  - `bin/station-map.py`
- current gap:
  - room launch path is shell/Kitty/Zellij-based, not a browser app in `apps/*`
  - detached dashboard launch remains separate from the stable TV wall command
  - current writable node inventory is still limited relative to the older mirror
- topology target from older mirror:
  - `15` MCP integrations
  - `15` engines
  - `15` adapters
  - `15` server slots
  - `15` hooks
  - `75` active selected-local lanes

### `ARCHIVING_ROOM`

- status: `partial_mapping`
- role: immutable records, signed history, rollback reference, audit retention
- current Kitty surfaces:
  - `evidence/*`
  - `evidence/journal/*`
  - `data/tables/*`

### `FEEDBACK_CLOUD_VYRDX_ROOM`

- status: `partial_mapping`
- role: intake, processing, aggregation, AI/service response, VYRDX-facing outbound flow
- current Kitty surfaces:
  - `bin/kitty-feedback-cloud-room.sh`
  - `shell/layouts/zellij/feedback_cloud_vyrdx_room.kdl`
  - `room/feedback_cloud_vyrdx_room/*`
  - `modules/reports/*`
  - `data/tables/*`
  - bridge-dispatched external nodes

### `SZH_CENTRAL_BRAIN`

- status: `partial_mapping`
- role: orchestration, policy routing, synthesis, coordination, decision support, and live MCP-configured room control
- current Kitty surfaces:
  - `command-bus/brain.gateway.ts`
  - `modules/memory/*`
  - `modules/rag/*`
  - `modules/calendar/*`
  - `bridge/*`
- current gap:
  - writable core has provider bridge logic, but not the full older mirror control-plane members
  - loopback private gateway and tunnel-fabric nervous system still live only in the read-only mirror
  - live room-to-brain wiring through MCP connectors is not closed in the writable tree
- topology target from older mirror:
  - authenticated private gateway on `127.0.0.1:46080`
  - tunnel-fabric nervous system with `150` reserved slots
  - `75` active stack-derived lanes
  - control-plane members: gateway, tunnel fabric, nervous system, ssh kitten, terminal bridge

### `VYRDOX_HIDDEN_ROOT`

- status: `contract_boundary`
- role: hidden intelligence substrate and non-public root layer
- canonical path anchor:
  - `/local/VXSTATION/VYRDOX`
- exposure rule:
  - not exposed as public runtime
  - not merged with `VYRDX`
  - surfaced into Kitty only through controlled boundaries

## Support Layers

These remain part of Kitty, but are not separate canonical rooms:

- `bin/`
- `bridge/`
- `command-bus/`
- `dispatch/`
- `docker/`
- `infra/`
- `modules/`
- `evidence/`
- `data/`

Current posture:

- live operator surfaces are currently delivered through `bin/`, `shell/layouts/zellij/`, and `room/`
- `apps/` is not the active surface model for this writable tree
- `infra/` is support/control-plane material, not the live panel delivery path
- the writable core is a shell/Kitty/Zellij deployment, not a browser-admin deployment

## Terminal Maintenance Plane

The terminal surface is the remote maintenance/control surface for the station model.

Locked rooms:

- `ai_room` -> AI Room push/control lane
- `vyrdon` -> VYRDON and authority-facing maintenance lane
- `media_room` -> media transfer and maintenance support lane

Current state:

- room contract locked
- host/path bindings still need final configuration

## Live Digital Engine Wiring

Central brain and room wiring now include:

- `Netdata Cloud` -> `http://127.0.0.1:19999/api/v1/info`
- `ClickHouse` -> `http://127.0.0.1:8123/ping`
- `Tenderly CLI` -> `tenderly`
- `e6a5/radar` -> `radar`
- `OctoSQL` -> `octosql`
- `Steampipe` -> `steampipe`

Wiring map source:

- `data/vxstation_room_service_map.json`
- `infra/room_wiring/digital_engine_wiring.manifest.json`
- `docs/agentgateway-control-plane.md`
