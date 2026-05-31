# VXSTATION Central Brain Context Freeze

Frozen at: 2026-04-04T09:10:30+00:00
Root: /opt/kitty

## Why this freeze exists

This freeze records the real stop point after drift between:

- the older room-based mirror at `/home/t79/vscode/codex/kitty/vxstation`
- the newer writable modular Kitty core at `/opt/kitty`

Termius is not the current priority.  
The unfinished priority is:

1. finalize `VXSTATION`
2. complete `SZH_CENTRAL_BRAIN`
3. close the API factory and runtime/control integration
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

Termius maintenance rooms are separate and locked to:

- `ai_room`
- `vyrdon`
- `media_room`

## What is confirmed built

### Kitty core health

- `/opt/kitty` runs clean on:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run ci:mandatory`

### Central brain provider layer

The real provider bridge exists in:

- `command-bus/brain.gateway.ts`

Confirmed behavior:

- handles `vxstation.brain.*` targets
- resolves provider priority from `BRAIN_PROVIDER_PRIORITY`
- supports `vllm` and `openrouter`
- fails closed if provider is not configured
- performs OpenAI-compatible `chat/completions` calls
- writes evidence refs into the command flow

### Kitty startup/provider boot path

The current startup path exists in:

- `bin/kitty-up.sh`
- `docker/compose.yml`

Confirmed behavior:

- pulls `OPENROUTER_*` values from shell if missing
- exports them before startup
- starts OpenHands
- prepares optional `vllm` service in compose

### Older explicit SZH control-plane design still exists in mirror

The older room-based mirror documents the intended `SZH` control plane in:

- `/home/t79/vscode/codex/kitty/vxstation/szhr/brain/orchestrator/control_plane/SZH_CENTRAL_BRAIN_ARCHITECTURE.md`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/brain/orchestrator/control_plane/control_plane.manifest.json`

That design confirms:

- `SZH` tunnel fabric is the nervous system
- gateway is the heart
- logic/memory stays inside `SZH`
- `Letta` + `Qdrant` are part of the logic layer
- `ssh_kitten`, gateway, tunnel fabric, and bridge were planned as members of the central brain control plane

## What is confirmed for VYRDX runtime

VYRDX boundary files:

- `/home/t79/VYRDON/VYRDX/SERVICES.md`
- `/home/t79/VYRDON/VYRDX/services/service_manifest.json`
- `/home/t79/VYRDON/VYRDX/services/service_boundaries.md`

Confirmed runtime rule:

- `VYRDX` is runtime authority
- `VXSTATION` is not runtime authority
- runtime root is documented as `/srv/vyrdx/current`

Confirmed service groups:

- `runtime.gateway`
- `runtime.policy`
- `runtime.registry`
- `mcp.edge`
- `vector.rag`
- `verify.deploy`
- `observability.recovery`
- `security.api_factory`

## API factory stop-point

`security.api_factory` is declared in the VYRDX service manifest and service definitions.

Relevant files:

- `/home/t79/VYRDON/VYRDX/services/service_manifest.json`
- `/home/t79/VYRDON/VYRDX/services/service_definitions.py`
- `/home/t79/VYRDON/VYRDX/config/ai/api_factory_gateway.json`
- `/home/t79/VYRDON/VYRDX/services/mcp/configs/api_factory_mcp_auth.json`
- `/home/t79/VYRDON/VYRDX/runtime/state/api_factory/context_freeze_latest.md`

What is important:

- the previous freeze says API Factory was built
- gateway signing key and registry exist
- gateway auth config exists
- MCP auth bridge config exists

## Critical drift found during recovery

### 1. The writable Kitty core is not the older room tree

The writable source of truth is:

- `/opt/kitty`

It is a modular core with:

- `apps/`
- `bridge/`
- `command-bus/`
- `dispatch/`
- `modules/`
- `data/`
- `evidence/`

It is not yet the literal room tree you want on disk.

### 2. The older room-based tree is in the read-only mirror

The room-first layout with explicit `SZH_CENTRAL_BRAIN` exists under:

- `/home/t79/vscode/codex/kitty/vxstation`

That copy was not writable as `t79` during this session because it is owned by `codexsvc`.

### 3. API Factory source path drift exists

The service registry still points to:

- `code/python/services/api_factory.py`

But the `.py` source file is currently missing; only the compiled `__pycache__` file remains.

This means the service metadata says API Factory exists, but the source path recorded in service definitions is stale.

### 4. Cloud runtime root is not present on this machine

The documented runtime root:

- `/srv/vyrdx/current`

does not exist on this machine right now.

That means this machine is not currently showing a mounted/live VYRDX cloud runtime tree at the documented path.

### 5. App surfaces are still empty

These directories exist but are empty:

- `/opt/kitty/apps/api`
- `/opt/kitty/apps/admin`
- `/opt/kitty/apps/web`

This is one of the strongest signals that the station finalization stopped before the UI/API surfaces were actually installed.

## Current best interpretation of the unfinished work

The real unfinished work is:

- finalize the room contract into the writable Kitty core
- complete the practical `SZH_CENTRAL_BRAIN` surface around the existing brain gateway
- reconnect or restore the real `API Factory` source and command surface
- reconcile the writable modular core with the older room-based architecture
- only after that, configure Termius

## Do not drift

Do not switch back to Termius first.

Do not treat Termius as proof that VXSTATION is complete.

Do not treat the passing TypeScript tests alone as proof that delivery is complete.

The delivery gap is architecture closure and runtime/control integration, not just lint/test status.

## If context is lost

Start here:

1. `/opt/kitty/docs/architecture/context_freeze_latest.md`
2. `/opt/kitty/docs/contracts/vxstation-room-contract.md`
3. `/opt/kitty/docs/architecture/vxstation-room-service-map.md`
4. `/home/t79/VYRDON/VYRDX/runtime/state/api_factory/context_freeze_latest.md`

Then reopen these implementation anchors:

- `/opt/kitty/command-bus/brain.gateway.ts`
- `/opt/kitty/bin/kitty-up.sh`
- `/home/t79/VYRDON/VYRDX/services/service_manifest.json`
- `/home/t79/VYRDON/VYRDX/services/service_definitions.py`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/brain/orchestrator/control_plane/SZH_CENTRAL_BRAIN_ARCHITECTURE.md`
- `/home/t79/vscode/codex/kitty/vxstation/szhr/brain/orchestrator/control_plane/control_plane.manifest.json`
