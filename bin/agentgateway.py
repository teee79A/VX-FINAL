#!/usr/bin/env python3
import argparse
import hmac
import json
import os
import subprocess
import threading
import time
import uuid
from collections import defaultdict, deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


class GatewayState:
    def __init__(self, policy_path: Path):
        self.policy_path = policy_path
        self.policy = load_json(policy_path)
        self.registry_path = Path(str(self.policy["command_registry"]))
        self.registry = load_json(self.registry_path)
        self.registry_mtime = self.registry_path.stat().st_mtime if self.registry_path.exists() else 0.0
        self.lock = threading.Lock()
        self.request_windows: dict[str, deque[float]] = defaultdict(deque)
        self.token_cache = ""
        self.token_mtime = 0.0

    def load_token(self) -> str:
        token_path = Path(str(self.policy["token_file"]))
        if not token_path.exists():
            return ""
        stat = token_path.stat()
        if self.token_mtime != stat.st_mtime:
            self.token_cache = token_path.read_text(encoding="utf-8").strip()
            self.token_mtime = stat.st_mtime
        return self.token_cache

    def command_count(self) -> int:
        self.load_registry()
        return len(self.registry.get("commands", []))

    def get_command(self, command_id: str) -> dict[str, Any] | None:
        self.load_registry()
        for command in self.registry.get("commands", []):
            if str(command.get("id", "")).strip() == command_id:
                return command
        return None

    def load_registry(self) -> None:
        if not self.registry_path.exists():
            return
        stat = self.registry_path.stat()
        if self.registry_mtime != stat.st_mtime:
            self.registry = load_json(self.registry_path)
            self.registry_mtime = stat.st_mtime

    def allow_request(self, remote_ip: str, caller: str) -> bool:
        now = time.time()
        rate_limit = self.policy.get("rate_limit", {})
        max_requests = int(rate_limit.get("requests", 90) or 90)
        window_seconds = int(rate_limit.get("window_seconds", 60) or 60)
        bucket_key = f"{remote_ip}:{caller}"
        with self.lock:
            bucket = self.request_windows[bucket_key]
            while bucket and (now - bucket[0]) > window_seconds:
                bucket.popleft()
            if len(bucket) >= max_requests:
                return False
            bucket.append(now)
        return True

    def audit(self, record: dict[str, Any]) -> None:
        audit_path = Path(str((self.policy.get("runtime") or {}).get("audit_log", "")))
        if not str(audit_path):
            return
        audit_path.parent.mkdir(parents=True, exist_ok=True)
        with audit_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, sort_keys=True) + "\n")


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def is_loopback(ip: str) -> bool:
    return ip in {"127.0.0.1", "::1", "::ffff:127.0.0.1"}


class AgentGatewayHandler(BaseHTTPRequestHandler):
    server_version = "VXStationAgentGateway/1.0"

    def _request_id(self) -> str:
        return uuid.uuid4().hex

    def _client_ip(self) -> str:
        return self.client_address[0]

    def _caller(self) -> str:
        return str(self.headers.get("X-VXSTATION-Caller", "")).strip()

    def _read_json_body(self) -> dict[str, Any]:
        max_body_bytes = int(self.server.state.policy.get("max_body_bytes", 16384) or 16384)
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length > max_body_bytes:
            raise ValueError("body_too_large")
        if content_length == 0:
            return {}
        raw = self.rfile.read(content_length)
        if len(raw) > max_body_bytes:
            raise ValueError("body_too_large")
        return json.loads(raw.decode("utf-8"))

    def _authenticate(self, request_id: str) -> dict[str, str] | None:
        policy = self.server.state.policy
        remote_ip = self._client_ip()
        caller = self._caller()

        if bool(policy.get("loopback_only", True)) and not is_loopback(remote_ip):
            self.server.state.audit(
                {
                    "ts": time.time(),
                    "request_id": request_id,
                    "event": "reject",
                    "reason": "non_loopback",
                    "remote_ip": remote_ip,
                    "caller": caller,
                    "path": self.path,
                }
            )
            json_response(self, HTTPStatus.FORBIDDEN, {"ok": False, "error": "loopback_only"})
            return None

        if bool(policy.get("require_caller_header", True)):
            allowed_callers = {str(value).strip() for value in policy.get("allowed_callers", [])}
            if caller not in allowed_callers:
                self.server.state.audit(
                    {
                        "ts": time.time(),
                        "request_id": request_id,
                        "event": "reject",
                        "reason": "caller_not_allowed",
                        "remote_ip": remote_ip,
                        "caller": caller,
                        "path": self.path,
                    }
                )
                json_response(self, HTTPStatus.FORBIDDEN, {"ok": False, "error": "caller_not_allowed"})
                return None

        if bool(policy.get("require_bearer_token", True)):
            auth = str(self.headers.get("Authorization", "")).strip()
            if not auth.startswith("Bearer "):
                json_response(self, HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "missing_bearer_token"})
                return None
            supplied_token = auth.split(" ", 1)[1].strip()
            expected_token = self.server.state.load_token()
            if not expected_token or not hmac.compare_digest(supplied_token, expected_token):
                self.server.state.audit(
                    {
                        "ts": time.time(),
                        "request_id": request_id,
                        "event": "reject",
                        "reason": "invalid_token",
                        "remote_ip": remote_ip,
                        "caller": caller,
                        "path": self.path,
                    }
                )
                json_response(self, HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "invalid_token"})
                return None

        if not self.server.state.allow_request(remote_ip, caller):
            json_response(self, HTTPStatus.TOO_MANY_REQUESTS, {"ok": False, "error": "rate_limited"})
            return None

        return {"remote_ip": remote_ip, "caller": caller}

    def _command_argv(self, command: dict[str, Any], params: dict[str, Any]) -> list[str]:
        argv = command.get("argv") or []
        if not isinstance(argv, list) or not argv:
            raise ValueError("invalid_command_argv")
        for token in argv:
            if not isinstance(token, str) or not token.strip():
                raise ValueError("invalid_command_argv")
        base = str(argv[0]).strip()
        if not base.startswith("/"):
            raise ValueError("argv_base_must_be_absolute_path")
        if not os.path.exists(base):
            raise ValueError("argv_base_not_found")

        out = [str(token) for token in argv]
        for name, spec in (command.get("params") or {}).items():
            required = bool(spec.get("required", False))
            value = params.get(name)
            if required and value in {None, ""}:
                raise ValueError(f"missing_param:{name}")
            if value is None:
                continue
            if not isinstance(value, str):
                raise ValueError(f"invalid_param_type:{name}")
            max_length = int(spec.get("max_length", 240) or 240)
            if len(value) > max_length:
                raise ValueError(f"param_too_long:{name}")
            out.append(value)
        return out

    def _dispatch(self, request_id: str, auth: dict[str, str], body: dict[str, Any]) -> None:
        command_id = str(body.get("command", "")).strip()
        if not command_id:
            json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "missing_command"})
            return

        command = self.server.state.get_command(command_id)
        if command is None:
            json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "unknown_command"})
            return

        params = body.get("params") or {}
        if not isinstance(params, dict):
            json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid_params"})
            return

        try:
            argv = self._command_argv(command, params)
        except ValueError as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return

        timeout_seconds = int(command.get("timeout_seconds", self.server.state.policy.get("request_timeout_seconds", 30)) or 30)
        started = time.time()
        try:
            completed = subprocess.run(
                argv,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                env={**os.environ, "VXSTATION_GATEWAY_CALLER": auth["caller"]},
            )
            duration_ms = int((time.time() - started) * 1000)
            payload = {
                "ok": completed.returncode == 0,
                "service": "vxstation-agentgateway",
                "command": command_id,
                "returncode": completed.returncode,
                "duration_ms": duration_ms,
                "stdout": completed.stdout[-64000:],
                "stderr": completed.stderr[-16000:],
            }
            self.server.state.audit(
                {
                    "ts": time.time(),
                    "request_id": request_id,
                    "event": "dispatch",
                    "command": command_id,
                    "returncode": completed.returncode,
                    "duration_ms": duration_ms,
                    "caller": auth["caller"],
                    "remote_ip": auth["remote_ip"],
                }
            )
            json_response(self, HTTPStatus.OK, payload)
        except subprocess.TimeoutExpired:
            self.server.state.audit(
                {
                    "ts": time.time(),
                    "request_id": request_id,
                    "event": "dispatch_timeout",
                    "command": command_id,
                    "caller": auth["caller"],
                    "remote_ip": auth["remote_ip"],
                }
            )
            json_response(self, HTTPStatus.GATEWAY_TIMEOUT, {"ok": False, "error": "command_timeout"})

    def do_GET(self) -> None:
        request_id = self._request_id()
        remote_ip = self._client_ip()
        if bool(self.server.state.policy.get("loopback_only", True)) and not is_loopback(remote_ip):
            json_response(self, HTTPStatus.FORBIDDEN, {"ok": False, "error": "loopback_only"})
            return

        if self.path == "/health":
            payload = {
                "ok": True,
                "service": "vxstation-agentgateway",
                "status": "running",
                "gateway_id": self.server.state.policy.get("gateway_id"),
                "bind": f"{self.server.state.policy.get('bind_host')}:{self.server.state.policy.get('bind_port')}",
                "commands": self.server.state.command_count(),
                "time": int(time.time() * 1000),
            }
            json_response(self, HTTPStatus.OK, payload)
            return

        auth = self._authenticate(request_id)
        if auth is None:
            return

        if self.path == "/v1/meta/commands":
            json_response(self, HTTPStatus.OK, {"ok": True, "service": "vxstation-agentgateway", "commands": self.server.state.registry})
            return

        if self.path == "/v1/meta/policy":
            policy = dict(self.server.state.policy)
            if "token_file" in policy:
                policy["token_file"] = "<hidden>"
            json_response(self, HTTPStatus.OK, {"ok": True, "service": "vxstation-agentgateway", "policy": policy})
            return

        json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        request_id = self._request_id()
        auth = self._authenticate(request_id)
        if auth is None:
            return

        if self.path != "/v1/control/dispatch":
            json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
            return

        try:
            body = self._read_json_body()
        except ValueError as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "invalid_json"})
            return

        self._dispatch(request_id, auth, body)

    def log_message(self, format_string: str, *args: object) -> None:
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    policy_path = Path(args.policy).resolve()
    state = GatewayState(policy_path)
    bind_host = str(state.policy.get("bind_host", "127.0.0.1")).strip() or "127.0.0.1"
    bind_port = int(state.policy.get("bind_port", 46080) or 46080)

    server = ThreadingHTTPServer((bind_host, bind_port), AgentGatewayHandler)
    server.state = state

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
