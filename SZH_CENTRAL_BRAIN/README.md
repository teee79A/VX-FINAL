# SZH_CENTRAL_BRAIN

Central control room for VXSTATION command, policy, orchestration, and evidence.

## Surfaces

- `live_control_surface`
- `runtime_status`
- `operator_actions`
- `execution_monitoring`
- `evidence_linked_room_state`

## Orchestration domains

- `orchestration_logic`
- `policy_routing`
- `state_synthesis`
- `cross_room_coordination`
- `decision_support`

## Launch

Compiled runtime lives in `/home/t79/KITTY/SZH_CENTRAL_BRAIN/index.ts`.

Command intake is routed through `/home/t79/KITTY/command-bus/brain.gateway.ts`.

## Report

Topology is exposed by `/home/t79/KITTY/ENGINES/ceo/index.ts`.
