# MCP Time/Calendar Lane (AI_ROOM Central State)

This lane provides real central time/calendar state handling for Kitty through AI_ROOM.

## Endpoint

- `POST http://127.0.0.1:8792/dispatch`
- optional auth header: `x-kitty-token: <KITTY_MCP_TIME_CAL_TOKEN>`

## Allowed Intents

- `time.state.now`
- `calendar.state.get`
- `calendar.state.upsert`

## State Authority

- state file: `/home/t79/AI_ROOM/state/calendar_state.json`
- this service is routing-only from Kitty; execution authority remains outside Kitty

## Process Control

- Start: `/opt/kitty/bin/mcp-time-calendar-up.sh`
- Status: `/opt/kitty/bin/mcp-time-calendar-status.sh`
- Stop: `/opt/kitty/bin/mcp-time-calendar-down.sh`

## Direct Dispatch Examples

Get current time:

```bash
curl -X POST http://127.0.0.1:8792/dispatch \
  -H 'content-type: application/json' \
  -d '{
    "dispatch_ref": "manual:time:1",
    "intent": "time.state.now",
    "payload": {}
  }'
```

Upsert calendar state:

```bash
curl -X POST http://127.0.0.1:8792/dispatch \
  -H 'content-type: application/json' \
  -d '{
    "dispatch_ref": "manual:calendar:1",
    "intent": "calendar.state.upsert",
    "payload": {
      "atUtc": "2026-03-28T10:30:00Z",
      "title": "Kitty Sync"
    }
  }'
```

## Kitty Bridge Integration

Bridge node defaults are defined in:

- `/opt/kitty/bridge/nodes.json`

Bridge route conventions:

- command target: `vxstation.bridge.*`
- required capabilities include one of:
  - `time.state`
  - `calendar.state`

Kitty bridge dispatch sends requests to `<node.endpoint>/dispatch`.
