# VXSTATION Room Port Inventory

This inventory records the room surfaces and launch entrypoints that still live in the older mirror and need to be rebuilt or ported into the writable Kitty tree at `/opt/kitty`.

## Source trees

- writable target: `/opt/kitty`
- older mirror source: `/home/t79/vscode/codex/kitty/vxstation`

## High-tech live surface target

The intended station surface is a multi-panel Kitty/Zellij control wall, not a static shell.

Confirmed live-surface source files:

- `shell/layouts/zellij/vxstation.kdl`
- `main_interface/render_vxstation_room_matrix.sh`
- `main_interface/render_vxstation_event_bus.sh`
- `main_interface/render_vxstation_filesystem_panel.sh`

Confirmed launcher entrypoints:

- `shell/layouts/zellij/launchers/launch_live_surface.sh`
- `shell/layouts/zellij/launchers/launch_vxstation_room_matrix.sh`
- `shell/layouts/zellij/launchers/launch_vxstation_event_bus.sh`
- `shell/layouts/zellij/launchers/launch_vxstation_filesystem_panel.sh`
- `shell/layouts/zellij/launchers/launch_control_plane_live.sh`
- `shell/layouts/zellij/launchers/launch_szh_mcp_stream.sh`
- `shell/layouts/zellij/launchers/launch_market_board.sh`
- `shell/layouts/zellij/launchers/launch_feedback_signal_aggregator.sh`
- `shell/layouts/zellij/launchers/launch_archiving_integrity_check.sh`

## Canonical room mapping

### `OPERATION_ROOM`

Primary source files:

- `room/operation_room/render_operation_room.sh`
- `room/operation_room/live_surface/render_live_surface.sh`
- `room/operation_room/foundation_room/render_foundation_room.sh`
- `room/operation_room/power_room/render_power_room.sh`
- `room/operation_room/power_room/stack_manifest.json`
- `room/operation_room/power_room/connectors/project_terminals.sh`
- `room/operation_room/market_board/render_market_board.sh`
- `room/operation_room/market_board/market_targets.json`

Live dependencies:

- `szhr/routing/private_gateway/gateway.manifest.json`
- `szhr/routing/tunnel_fabric/tunnel.manifest.json`
- `szhr/brain/orchestrator/control_plane/control_plane.manifest.json`
- `room/vyrdx_cloud_feed_room/runtime/state/feedback_lab_state.json`
- `room/vyrdx_cloud_feed_room/runtime/projection/current_target.json`

Observed purpose:

- live execution control
- power-room engine/server/MCP counts
- target/market board
- single-path gateway visibility
- feedback projection into operations

### `ARCHIVING_ROOM`

Primary source files:

- `room/archiving_room/render_archiving_room.sh`
- `room/archiving_room/launch_archiving_room.sh`
- `room/archiving_room/baselines/render_baselines.sh`
- `room/archiving_room/change_history/render_change_history.sh`
- `room/archiving_room/frozen_records/render_frozen_records.sh`
- `room/archiving_room/rollback_reference_state/render_rollback_reference_state.sh`
- `room/archiving_room/signed_logs/render_signed_logs.sh`
- `room/archiving_room/verify_latest_signed_log.sh`
- `room/archiving_room/freeze_record.sh`
- `room/archiving_room/restore_reference_state.sh`
- `room/archiving_room/sync_cold_storage.sh`

Vision layer:

- `room/archiving_room/vision/preview_archive_grid.sh`
- `room/archiving_room/vision/preview_asset.sh`
- `room/archiving_room/vision/timg_status.sh`

Observed purpose:

- immutable record vault
- signed archive verification
- rollback reference visibility
- archive visual grid

### `FEEDBACK_CLOUD_VYRDX_ROOM`

Primary source files:

- `room/vyrdx_cloud_feed_room/render_vyrdx_cloud_feed_room.sh`
- `room/vyrdx_cloud_feed_room/cloud_feedback_intake/render_cloud_feedback_intake.sh`
- `room/vyrdx_cloud_feed_room/feedback_processing/render_feedback_processing.sh`
- `room/vyrdx_cloud_feed_room/signal_aggregation/render_signal_aggregation.sh`
- `room/vyrdx_cloud_feed_room/ai_service_response_layer/render_ai_service_response_layer.sh`
- `room/vyrdx_cloud_feed_room/vyrdx_facing_feedback_outputs/render_vyrdx_facing_feedback_outputs.sh`
- `room/vyrdx_cloud_feed_room/feedback_lab_worker.sh`
- `room/vyrdx_cloud_feed_room/project_signal_to_operation_room.sh`

Observed purpose:

- cloud intake
- processing and normalization
- aggregation and signal scoring
- AI/service response
- projection back into Operation Room and VYRDX-facing outputs

### `SZH_CENTRAL_BRAIN`

Primary source files:

- `szhr/brain/orchestrator/control_plane/control_plane.manifest.json`
- `szhr/brain/orchestrator/control_plane/SZH_CENTRAL_BRAIN_ARCHITECTURE.md`
- `szhr/routing/private_gateway/gateway_server.py`
- `szhr/routing/private_gateway/gateway.manifest.json`
- `szhr/routing/private_gateway/gateway.policy.json`
- `szhr/routing/tunnel_fabric/tunnel.manifest.json`
- `szhr/routing/tunnel_fabric/tunnel.policy.json`
- `szhr/routing/tunnel_fabric/build_tunnel_manifest.py`
- `szhr/routing/tunnel_fabric/build_ssh_config.py`

Related live entrypoints:

- `shell/layouts/zellij/launchers/launch_control_plane_live.sh`
- `shell/layouts/zellij/launchers/launch_szh_mcp_stream.sh`
- `szhr/brain/ssh_kitten/ssh_kitten_status.sh`

Observed purpose:

- authenticated loopback heart
- SSH tunnel nervous system
- MCP stream/control-plane status
- live room coordination

### `VYRDOX_HIDDEN_ROOT`

Current writable anchor:

- `/local/VXSTATION/VYRDOX`

Observed rule:

- remains a controlled non-public root
- must not be merged into `VYRDX`

## Current writable-core baseline

Confirmed files already present in `/opt/kitty`:

- `command-bus/brain.gateway.ts`
- `bridge/*`
- `dispatch/hyper-bridge.dispatcher.ts`
- `bin/station-map.py`
- `bin/mcp-linux-admin.py`
- `bin/mcp-time-calendar-agent.py`
- `bin/mcp-voice-agent.py`
- `shell/event.stream.ts`
- `shell/layout.controller.ts`
- `shell/route.controller.ts`

Current writable gaps:

- live operator surfaces are not shipped from `apps/*` in this writable tree
- active room delivery is through `bin/`, `shell/layouts/zellij/`, and `room/`
- only `3` bridge nodes are currently declared
- private gateway and tunnel fabric are not yet ported into the writable tree

## Immediate implementation use

When the stack is posted, use this inventory to decide:

1. which engine/server lanes map into `OPERATION_ROOM/power_room`
2. which MCP connectors must be bound into `SZH_CENTRAL_BRAIN`
3. which live panels must be rebuilt first in the writable Kitty tree
4. which gateway/tunnel files must be ported before the TV-style control wall can be considered delivered
