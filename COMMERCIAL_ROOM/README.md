# COMMERCIAL_ROOM

Commercial execution room for live business operations on VXSTATION.

## Surfaces

- `live_control_surface`: single-view control map for room operators
- `runtime_status`: live health snapshots for engines and endpoints
- `operator_actions`: approved command set for start/stop/recover
- `execution_monitoring`: process, port, and runtime monitoring
- `evidence_linked_room_state`: auditable state snapshots and references

## Registries

- `engine_registry.tsv`: commercial engines and command checks
- `connector_registry.tsv`: adapters/connectors and room binding
- `server_registry.tsv`: service endpoints mapped into this room

## Kitty TV launch

Run:

`/home/t79/KITTY/bin/kitty-commercial-room.sh`

This opens a clickable Zellij tab wall in Kitty for the commercial room only.
