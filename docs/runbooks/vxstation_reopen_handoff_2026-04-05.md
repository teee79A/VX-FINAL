# VXSTATION Reopen Handoff

Date: 2026-04-05
Root: `/opt/kitty`

## Current State

- `VXSTATION` is implemented inside `KITTY`, not as a separate folder.
- `TERMINUSE` is dropped from the live model.
- `terminal/` is the active terminal naming.
- `vxstation-seal.py` currently returns `seal_status: READY`.
- `station-map.py` currently reports:
  - `radar.overall_status = green`
  - `vxstation_control = green`
  - `operation_room = green`
  - `central_brain = green`

## Runtime Endpoints

- `agentgateway`: `http://127.0.0.1:46080/health`
- `mcp-linux-admin`: `http://127.0.0.1:8877/health`
- `mcp-time-calendar-agent`: `http://127.0.0.1:8792/health`
- `mcp-voice-agent`: `http://127.0.0.1:8790/health`
- `n8n`: `http://127.0.0.1:5678/healthz`
- `netdata`: `http://127.0.0.1:19999/api/v1/info`

## What Was Fixed

- old `/home/t79/VXSTATION/kitty` runtime references removed from live processes
- KITTY runtime wrappers fixed so MCP + gateway services stay detached and alive
- `room_router.json` updated to include `VYRDOX_HIDDEN_ROOT`
- false-red Netdata handling fixed in `station-map.py`
- managed `n8n` launcher added
- feedback room now has real runtime artifacts in all 5 required sections
- archive room now has frozen records and a current baseline
- `VYRDOX_HIDDEN_ROOT` now has a local README marker

## Important Files

- `/opt/kitty/bin/vxstation-seal.py`
- `/opt/kitty/bin/station-map.py`
- `/opt/kitty/bin/kitty-up.sh`
- `/opt/kitty/bin/mcp-linux-admin-up.sh`
- `/opt/kitty/bin/mcp-time-calendar-up.sh`
- `/opt/kitty/bin/mcp-voice-agent-up.sh`
- `/opt/kitty/bin/agentgateway-up.sh`
- `/opt/kitty/bin/n8n-up.sh`
- `/opt/kitty/bin/n8n-down.sh`
- `/opt/kitty/bin/feedback-cloud-room-refresh.py`
- `/opt/kitty/bin/archive-room-freeze-current-state.sh`
- `/opt/kitty/data/vxstation_control/room_router.json`
- `/opt/kitty/VYRDOX_HIDDEN_ROOT/README.md`

## First Verify Commands

```bash
/opt/kitty/bin/vxstation-seal.py
python3 /opt/kitty/bin/station-map.py --pretty | jq '.radar'
curl -fsS http://127.0.0.1:5678/healthz
curl -fsS http://127.0.0.1:46080/health
```

## Residual Non-Blocking Items

- `COMMERCIAL_ROOM` is still an extra routed room in:
  - `/opt/kitty/data/vxstation_control/room_router.json`
- calendar still points to external:
  - `/home/t79/AI_ROOM/state/calendar_state.json`

## If Reopen Fails

Run:

```bash
bash /opt/kitty/bin/kitty-up.sh
bash /opt/kitty/bin/n8n-up.sh
/opt/kitty/bin/feedback-cloud-room-refresh.py
bash /opt/kitty/bin/archive-room-freeze-current-state.sh
```
