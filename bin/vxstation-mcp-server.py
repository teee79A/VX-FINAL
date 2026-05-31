#!/usr/bin/env python3
"""VXSTATION MCP adapter.

Bridges VS Code MCP tool calls to local VXSTATION control lanes:
- AgentGateway command dispatch (127.0.0.1:46080)
- MCP Linux Admin service intents (127.0.0.1:8877)

Protocol: MCP over stdio using JSON-RPC with Content-Length framing.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import re


class VXStationConfig:
    def __init__(self) -> None:
        self.gateway_base = os.environ.get("VXSTATION_GATEWAY_URL", "http://127.0.0.1:46080")
        self.linux_admin_base = os.environ.get("VXSTATION_LINUX_ADMIN_URL", "http://127.0.0.1:8877")
        self.token_file = Path(
            os.environ.get(
                "VXSTATION_GATEWAY_TOKEN_FILE",
                "/home/t79/KITTY/state/agentgateway/gateway.token",
            )
        )
        self.caller = os.environ.get("VXSTATION_CALLER", "OperatorLocal")
        self.timeout_seconds = int(os.environ.get("VXSTATION_HTTP_TIMEOUT", "30"))


class MCPError(Exception):
    def __init__(self, code: int, message: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data or {}


class VXStationAdapter:
    def __init__(self, cfg: VXStationConfig):
        self.cfg = cfg
        self._commands_cache: Optional[List[Dict[str, Any]]] = None
        self._token_re = re.compile(r"^[A-Za-z0-9_-]+$")

    def _http_json(
        self,
        method: str,
        url: str,
        payload: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        req_headers = {"content-type": "application/json"}
        if headers:
            req_headers.update(headers)

        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(url=url, data=data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.cfg.timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
                if not raw:
                    return {"ok": True}
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            raise MCPError(
                code=-32000,
                message=f"HTTP {exc.code} from {url}",
                data={"status": exc.code},
            )
        except urllib.error.URLError as exc:
            raise MCPError(
                code=-32000,
                message=f"Connection failed: {url}",
                data={"reason": str(exc.reason)},
            )
        except json.JSONDecodeError:
            raise MCPError(code=-32000, message=f"Invalid JSON from {url}")

    def _read_token(self) -> str:
        if not self.cfg.token_file.exists():
            raise MCPError(
                code=-32001,
                message=f"Gateway token file missing: {self.cfg.token_file}",
            )
        token = self.cfg.token_file.read_text(encoding="utf-8").strip()
        if not token:
            raise MCPError(
                code=-32001,
                message=f"Gateway token file empty: {self.cfg.token_file}",
            )
        if not self._token_re.match(token):
            raise MCPError(
                code=-32001,
                message=f"Invalid token format: {self.cfg.token_file}",
            )
        return token

    def gateway_health(self) -> Dict[str, Any]:
        return self._http_json("GET", f"{self.cfg.gateway_base}/health")

    def linux_admin_health(self) -> Dict[str, Any]:
        return self._http_json("GET", f"{self.cfg.linux_admin_base}/health")

    def list_gateway_commands(self, refresh: bool = False) -> List[Dict[str, Any]]:
        if self._commands_cache is not None and not refresh:
            return self._commands_cache

        token = self._read_token()
        payload = self._http_json(
            "GET",
            f"{self.cfg.gateway_base}/v1/meta/commands",
            headers={
                "Authorization": f"Bearer {token}",
                "X-VXSTATION-Caller": self.cfg.caller,
            },
        )
        commands = payload.get("commands", {}).get("commands", [])
        if not isinstance(commands, list):
            raise MCPError(code=-32000, message="Unexpected command registry payload")
        self._commands_cache = commands
        return commands

    def dispatch_gateway(self, command_id: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        token = self._read_token()
        body = {
            "command": command_id,
            "params": params or {},
        }
        return self._http_json(
            "POST",
            f"{self.cfg.gateway_base}/v1/control/dispatch",
            payload=body,
            headers={
                "Authorization": f"Bearer {token}",
                "X-VXSTATION-Caller": self.cfg.caller,
            },
        )

    def linux_admin_dispatch(
        self,
        intent: str,
        service: str,
        tail: Optional[int] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "intent": intent,
            "dispatch_ref": f"mcp-{int(time.time() * 1000)}",
            "payload": {"service": service},
        }
        if tail is not None:
            payload["payload"]["tail"] = int(tail)
        return self._http_json("POST", f"{self.cfg.linux_admin_base}/dispatch", payload=payload)


class MCPServer:
    def __init__(self, adapter: VXStationAdapter):
        self.adapter = adapter
        self.server_info = {
            "name": "vxstation-mcp-adapter",
            "version": "1.0.0",
        }

    def _read_message(self) -> Optional[Dict[str, Any]]:
        headers: Dict[str, str] = {}
        while True:
            line = sys.stdin.buffer.readline()
            if not line:
                return None
            line = line.rstrip(b"\r\n")
            if not line:
                break
            key, _, value = line.decode("utf-8", errors="replace").partition(":")
            headers[key.strip().lower()] = value.strip()

        length_str = headers.get("content-length")
        if not length_str:
            return None
        try:
            length = int(length_str)
        except ValueError:
            return None
        if length <= 0:
            return None

        body = sys.stdin.buffer.read(length)
        if not body or len(body) != length:
            return None
        return json.loads(body.decode("utf-8"))

    def _write_message(self, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n".encode("utf-8")
        sys.stdout.buffer.write(header)
        sys.stdout.buffer.write(body)
        sys.stdout.buffer.flush()

    def _reply(self, msg_id: Any, result: Dict[str, Any]) -> None:
        self._write_message({"jsonrpc": "2.0", "id": msg_id, "result": result})

    def _error(self, msg_id: Any, code: int, message: str, data: Optional[Dict[str, Any]] = None) -> None:
        payload: Dict[str, Any] = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {"code": code, "message": message},
        }
        if data:
            payload["error"]["data"] = data
        self._write_message(payload)

    def _tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "vxstation_health",
                "description": "Check VXSTATION gateway and Linux admin health.",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
            },
            {
                "name": "vxstation_commands_list",
                "description": "List allowed AgentGateway command IDs from registry.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "refresh": {"type": "boolean", "default": False},
                    },
                    "additionalProperties": False,
                },
            },
            {
                "name": "vxstation_command_dispatch",
                "description": "Dispatch a command through VXSTATION AgentGateway.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "command_id": {"type": "string"},
                        "params": {"type": "object", "default": {}},
                    },
                    "required": ["command_id"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "vxstation_service_control",
                "description": "Control OpenHands/vLLM service via Linux Admin lane.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "intent": {
                            "type": "string",
                            "enum": [
                                "ops.service.start",
                                "ops.service.stop",
                                "ops.service.restart",
                                "ops.service.status",
                                "ops.service.logs",
                            ],
                        },
                        "service": {
                            "type": "string",
                            "enum": ["openhands", "vllm"],
                        },
                        "tail": {"type": "integer", "minimum": 1, "maximum": 5000},
                    },
                    "required": ["intent", "service"],
                    "additionalProperties": False,
                },
            },
        ]

    def _handle_tool_call(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        if name == "vxstation_health":
            gateway = self.adapter.gateway_health()
            linux_admin = self.adapter.linux_admin_health()
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "gateway": gateway,
                                "linux_admin": linux_admin,
                            },
                            indent=2,
                        ),
                    }
                ]
            }

        if name == "vxstation_commands_list":
            refresh = bool(args.get("refresh", False))
            commands = self.adapter.list_gateway_commands(refresh=refresh)
            command_ids = [str(cmd.get("id", "")) for cmd in commands]
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "count": len(command_ids),
                                "commands": command_ids,
                            },
                            indent=2,
                        ),
                    }
                ]
            }

        if name == "vxstation_command_dispatch":
            raw_command_id = args.get("command_id")
            if not isinstance(raw_command_id, str) or not raw_command_id.strip():
                raise MCPError(-32602, "command_id must be a non-empty string")
            command_id = raw_command_id.strip()
            params = args.get("params", {})
            if not isinstance(params, dict):
                raise MCPError(-32602, "params must be an object")
            allowed = {str(cmd.get("id", "")).strip() for cmd in self.adapter.list_gateway_commands()}
            if command_id not in allowed:
                raise MCPError(-32602, f"Unknown command_id: {command_id}")
            result = self.adapter.dispatch_gateway(command_id, params)
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, indent=2),
                    }
                ]
            }

        if name == "vxstation_service_control":
            raw_intent = args.get("intent")
            raw_service = args.get("service")
            if not isinstance(raw_intent, str) or not isinstance(raw_service, str):
                raise MCPError(-32602, "intent and service must be strings")
            intent = raw_intent.strip()
            service = raw_service.strip()
            tail = args.get("tail")
            if not intent or not service:
                raise MCPError(-32602, "intent and service are required")
            if tail is not None and not isinstance(tail, int):
                raise MCPError(-32602, "tail must be an integer")
            result = self.adapter.linux_admin_dispatch(intent=intent, service=service, tail=tail)
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, indent=2),
                    }
                ]
            }

        raise MCPError(-32601, f"Unknown tool: {name}")

    def serve(self) -> None:
        while True:
            try:
                msg = self._read_message()
            except Exception as exc:
                self._error(None, -32700, "Parse error", {"reason": str(exc)})
                continue

            if msg is None:
                break

            msg_id = msg.get("id")
            method = msg.get("method")
            params = msg.get("params", {})

            if msg.get("jsonrpc") != "2.0":
                if msg_id is not None:
                    self._error(msg_id, -32600, "Invalid Request: jsonrpc must be 2.0")
                continue

            if not method:
                if msg_id is not None:
                    self._error(msg_id, -32600, "Invalid Request")
                continue

            try:
                if method == "initialize":
                    self._reply(
                        msg_id,
                        {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {"tools": {}},
                            "serverInfo": self.server_info,
                        },
                    )
                    continue

                if method == "notifications/initialized":
                    continue

                if method == "tools/list":
                    self._reply(msg_id, {"tools": self._tools()})
                    continue

                if method == "tools/call":
                    tool_name = str(params.get("name", "")).strip()
                    arguments = params.get("arguments", {})
                    if not isinstance(arguments, dict):
                        raise MCPError(-32602, "tool arguments must be an object")
                    result = self._handle_tool_call(tool_name, arguments)
                    self._reply(msg_id, result)
                    continue

                if method == "ping":
                    self._reply(msg_id, {"ok": True})
                    continue

                if msg_id is not None:
                    self._error(msg_id, -32601, f"Method not found: {method}")
            except MCPError as exc:
                self._error(msg_id, exc.code, exc.message, exc.data)
            except Exception as exc:
                self._error(msg_id, -32603, "Internal error", {"reason": str(exc)})


def main() -> None:
    cfg = VXStationConfig()
    adapter = VXStationAdapter(cfg)
    server = MCPServer(adapter)
    server.serve()


if __name__ == "__main__":
    main()
