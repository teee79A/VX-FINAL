#!/usr/bin/env python3
import json
import os
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Tuple

HOST = os.environ.get("KITTY_MCP_LINUX_ADMIN_HOST", "127.0.0.1")
PORT = int(os.environ.get("KITTY_MCP_LINUX_ADMIN_PORT", "8877"))
COMPOSE_FILE = os.environ.get(
    "KITTY_COMPOSE_FILE", "/home/t79/KITTY/docker/compose.yml"
)
AUTH_TOKEN = os.environ.get("KITTY_MCP_LINUX_ADMIN_TOKEN", "")

SERVICE_MAP = {
    "openhands": "openhands-app",
    "vllm": "vllm-openai",
}

ALLOWED_INTENTS = {
    "ops.service.start",
    "ops.service.stop",
    "ops.service.restart",
    "ops.service.status",
    "ops.service.logs",
}


def run_command(argv: list[str]) -> Tuple[int, str]:
    proc = subprocess.run(argv, capture_output=True, text=True)
    output = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, output.strip()


def validate_request(body: Dict[str, Any]) -> Tuple[bool, str]:
    intent = str(body.get("intent", ""))
    payload = body.get("payload", {})
    service = str((payload or {}).get("service", ""))

    if intent not in ALLOWED_INTENTS:
        return False, f"Intent not allowed: {intent}"
    if service not in SERVICE_MAP:
        return False, f"Service not allowed: {service}"
    return True, ""


def handle_intent(body: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    intent = str(body.get("intent", ""))
    payload = body.get("payload", {})
    service = str(payload.get("service", ""))
    tail = int(payload.get("tail", 80))
    container = SERVICE_MAP[service]

    if intent == "ops.service.start":
        code, output = run_command(
            ["docker-compose", "-f", COMPOSE_FILE, "up", "-d", service]
        )
        return (code == 0, output, {"service": service, "container": container})

    if intent == "ops.service.stop":
        code, output = run_command(["docker-compose", "-f", COMPOSE_FILE, "stop", service])
        return (code == 0, output, {"service": service, "container": container})

    if intent == "ops.service.restart":
        code, output = run_command(
            ["docker-compose", "-f", COMPOSE_FILE, "restart", service]
        )
        return (code == 0, output, {"service": service, "container": container})

    if intent == "ops.service.logs":
        code, output = run_command(
            ["docker-compose", "-f", COMPOSE_FILE, "logs", "--tail", str(tail), service]
        )
        return (
            code == 0,
            output,
            {"service": service, "container": container, "tail": tail},
        )

    inspect_code, inspect_output = run_command(
        ["docker", "inspect", "--format", "{{.State.Status}}", container]
    )
    if inspect_code != 0:
        return (
            True,
            "not_found",
            {"service": service, "container": container, "state": "not_found"},
        )
    return (
        True,
        inspect_output,
        {"service": service, "container": container, "state": inspect_output},
    )


class Handler(BaseHTTPRequestHandler):
    def _write(self, code: int, payload: Dict[str, Any]) -> None:
        wire = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(wire)))
        self.end_headers()
        self.wfile.write(wire)

    def do_GET(self) -> None:
        if self.path != "/health":
            self._write(404, {"ok": False, "error": "not_found"})
            return
        self._write(
            200,
            {
                "ok": True,
                "service": "mcp-linux-admin",
                "time": int(time.time() * 1000),
                "compose_file": COMPOSE_FILE,
            },
        )

    def do_POST(self) -> None:
        if self.path != "/dispatch":
            self._write(404, {"accepted": False, "error": "not_found"})
            return

        if AUTH_TOKEN:
            token = self.headers.get("x-kitty-token", "")
            if token != AUTH_TOKEN:
                self._write(401, {"accepted": False, "error": "unauthorized"})
                return

        try:
            raw = self.rfile.read(int(self.headers.get("content-length", "0")))
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            self._write(400, {"accepted": False, "error": "invalid_json"})
            return

        ok, reason = validate_request(body)
        if not ok:
            self._write(403, {"accepted": False, "reason": reason})
            return

        accepted, message, data = handle_intent(body)
        response = {
            "accepted": accepted,
            "message": message,
            "intent": body.get("intent"),
            "dispatch_ref": body.get("dispatch_ref"),
            "data": data,
        }
        self._write(200 if accepted else 500, response)

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep daemon quiet; logs are written by launcher scripts.
        return


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"mcp-linux-admin listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
