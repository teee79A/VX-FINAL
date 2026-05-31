# MCP Linux Admin Lane (Real ON/OFF Control)

This lane provides real service power control for the Kitty stack through an external MCP admin endpoint.

## Endpoint

- `POST http://127.0.0.1:8877/dispatch`
- optional auth header: `x-kitty-token: <KITTY_MCP_LINUX_ADMIN_TOKEN>`

## Allowed Intents

- `ops.service.start`
- `ops.service.stop`
- `ops.service.restart`
- `ops.service.status`
- `ops.service.logs`

## Allowed Services

- `openhands`
- `vllm`

## Process Control

- Start: `/opt/kitty/bin/mcp-linux-admin-up.sh`
- Status: `/opt/kitty/bin/mcp-linux-admin-status.sh`
- Stop: `/opt/kitty/bin/mcp-linux-admin-down.sh`

## Direct Dispatch Example

```bash
curl -X POST http://127.0.0.1:8877/dispatch \
  -H 'content-type: application/json' \
  -d '{
    "dispatch_ref": "manual:ops:1",
    "intent": "ops.service.status",
    "payload": { "service": "openhands" }
  }'
```

## Kitty Bridge Integration

Bridge node defaults are defined in:

- `/opt/kitty/bridge/nodes.json`

Bridge route conventions:

- command target: `vxstation.bridge.*`
- required capabilities include one of:
  - `linux.admin.power`
  - `linux.admin.status`
  - `linux.admin.logs`

Kitty bridge dispatch sends requests to `<node.endpoint>/dispatch`.
