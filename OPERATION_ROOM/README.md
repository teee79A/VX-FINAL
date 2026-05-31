# OPERATION_ROOM

Live operations room for execution control, runtime health, and operator actions.

## Surfaces

- `live_control_surface`
- `runtime_status`
- `operator_actions`
- `execution_monitoring`
- `evidence_linked_room_state`

## Ops Brain

Outcome-oriented SOP system:

- `ops_brain/sops/sales_cycle.md`
- `ops_brain/sops/fulfillment.md`
- `ops_brain/sops/ops_handoff.md`

Run with:

- `/home/t79/KITTY/bin/ops-brain.sh list`
- `/home/t79/KITTY/bin/ops-brain.sh run sales_cycle`

## ZSH Automation Hub

Install Oh My Zsh link:

- `/home/t79/KITTY/bin/zsh-automation-hub.sh install`

Automation commands:

- `vxhub status`
- `vx-sales`
- `vx-fulfill`
- `vx-handoff`

## Launch

`/home/t79/KITTY/bin/kitty-operation-room.sh --reset`

## Report

`/home/t79/KITTY/bin/operation-room-report.sh`
