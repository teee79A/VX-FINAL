# AgentGateway Control Plane

Real control path for VXSTATION business/cloud operations:

1. Operator or room engine calls `AgentGateway` on loopback `127.0.0.1:46080`.
2. `AgentGateway` enforces:
   - bearer token
   - caller allowlist
   - loopback-only access
   - rate-limit
   - command allowlist from registry
3. Gateway dispatches only approved commands.
4. Commands route to:
   - local stack control (`kitty-*`)
   - MCP lanes (`mcp-linux-admin-*`, `mcp-time-calendar-*`)
   - real runtime health checks (`Netdata`, `ClickHouse`, engine CLIs)
5. Every dispatch writes audit records.

Control artifacts:

- Policy: `infra/szh_central_brain/gateways/agentgateway.policy.json`
- Command allowlist: `infra/szh_central_brain/gateways/agentgateway.command_registry.json`
- Server: `bin/agentgateway.py`
- Runtime audit log: `state/agentgateway/audit.jsonl`

Operational commands:

- Start: `bin/agentgateway-up.sh`
- Status: `bin/agentgateway-status.sh`
- Stop: `bin/agentgateway-down.sh`
- Dispatch request: `bin/agentgateway-request.sh <command_id> [params_json] [caller]`
