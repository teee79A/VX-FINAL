#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib import error, request

import typer


ROOT = Path("/home/t79/KITTY")
GATEWAY_URL = "http://127.0.0.1:46080"
TOKEN_FILE = ROOT / "state/agentgateway/gateway.token"
PYTHON_RUN = str(ROOT / "bin" / "vxstation-python-run.sh")
SURFACE_LAUNCH = ROOT / "bin" / "vxstation_surface_launch.py"

LOCAL_COMMANDS: dict[str, list[str]] = {
    "gateway.up": [str(ROOT / "bin/agentgateway-up.sh")],
    "gateway.down": [str(ROOT / "bin/agentgateway-down.sh")],
    "gateway.status": [str(ROOT / "bin/agentgateway-status.sh")],
    "stack.up": [str(ROOT / "bin/kitty-up.sh")],
    "stack.down": [str(ROOT / "bin/kitty-down.sh")],
    "stack.status": [str(ROOT / "bin/kitty-status.sh")],
    "stack.tv": [str(ROOT / "bin" / "kitty-tv-wall.sh")],
    "stack.tv.reset": [str(ROOT / "bin" / "kitty-tv-wall.sh"), "--reset"],
    "room.operation.open": [str(ROOT / "bin" / "kitty-operation-room.sh"), "--reset"],
    "room.commercial.open": [str(ROOT / "bin" / "kitty-commercial-room.sh"), "--reset"],
    "room.archive.open": [str(ROOT / "bin" / "kitty-archive-room.sh"), "--reset"],
    "room.feedback.open": [str(ROOT / "bin" / "kitty-feedback-cloud-room.sh"), "--reset"],
    "room.central_brain.open": [str(ROOT / "bin" / "kitty-central-brain.sh"), "--reset"],
    "room.radar.open": [PYTHON_RUN, str(SURFACE_LAUNCH), "radar"],
    "mcp.linux.up": [str(ROOT / "bin/mcp-linux-admin-up.sh")],
    "mcp.linux.down": [str(ROOT / "bin/mcp-linux-admin-down.sh")],
    "mcp.linux.status": [str(ROOT / "bin/mcp-linux-admin-status.sh")],
    "mcp.time.up": [str(ROOT / "bin/mcp-time-calendar-up.sh")],
    "mcp.time.down": [str(ROOT / "bin/mcp-time-calendar-down.sh")],
    "mcp.time.status": [str(ROOT / "bin/mcp-time-calendar-status.sh")],
    "mcp.voice.up": [str(ROOT / "bin/mcp-voice-agent-up.sh")],
    "mcp.voice.down": [str(ROOT / "bin/mcp-voice-agent-down.sh")],
    "mcp.voice.status": [str(ROOT / "bin/mcp-voice-agent-status.sh")],
}

STACK_UP_DOWN = {"stack.up", "stack.down", "gateway.up", "gateway.down"}
ROOM_COMMANDS = {
    "operation": "room.operation.open",
    "commercial": "room.commercial.open",
    "archive": "room.archive.open",
    "feedback": "room.feedback.open",
    "brain": "room.central_brain.open",
    "radar": "room.radar.open",
}
LOCAL_PARAM_ORDER = {
    "room.radar.open": ["layer"],
}
MCP_COMMANDS = {
    "linux": {
        "up": "mcp.linux.up",
        "down": "mcp.linux.down",
        "status": "mcp.linux.status",
    },
    "time": {
        "up": "mcp.time.up",
        "down": "mcp.time.down",
        "status": "mcp.time.status",
    },
    "voice": {
        "up": "mcp.voice.up",
        "down": "mcp.voice.down",
        "status": "mcp.voice.status",
    },
}

app = typer.Typer(no_args_is_help=True, help="VXSTATION KITTY typed control surface")
gateway_app = typer.Typer(no_args_is_help=True, help="Gateway server controls")
stack_app = typer.Typer(no_args_is_help=True, help="Stack controls")
room_app = typer.Typer(no_args_is_help=True, help="Room controls")
mcp_app = typer.Typer(no_args_is_help=True, help="MCP room controls")
station_app = typer.Typer(no_args_is_help=True, help="Station status")
dashboard_app = typer.Typer(no_args_is_help=True, help="Dashboard surfaces")
brain_app = typer.Typer(no_args_is_help=True, help="Central brain inventory")

app.add_typer(gateway_app, name="gateway")
app.add_typer(stack_app, name="stack")
app.add_typer(room_app, name="room")
app.add_typer(mcp_app, name="mcp")
app.add_typer(station_app, name="station")
app.add_typer(dashboard_app, name="dashboard")
app.add_typer(brain_app, name="brain")


def _print_json(payload: Any) -> None:
    typer.echo(json.dumps(payload, indent=2, sort_keys=True))


def _token() -> str:
    if not TOKEN_FILE.exists():
        return ""
    return TOKEN_FILE.read_text("utf-8").strip()


def gateway_ready() -> bool:
    try:
        req = request.Request(f"{GATEWAY_URL}/health", method="GET")
        with request.urlopen(req, timeout=2) as res:
            payload = json.loads(res.read().decode("utf-8"))
            return bool(payload.get("ok"))
    except Exception:
        return False


def _http_json(method: str, url: str, payload: dict[str, Any] | None, caller: str) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = request.Request(url, method=method, data=body)
    req.add_header("content-type", "application/json")
    token = _token()
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    req.add_header("X-VXSTATION-Caller", caller)
    try:
        with request.urlopen(req, timeout=30) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        detail = json.loads(raw) if raw else {"ok": False, "error": f"http_{exc.code}"}
        raise typer.Exit(code=1) from RuntimeError(detail)
    except error.URLError as exc:
        raise typer.Exit(code=1) from RuntimeError(str(exc))


def _local_run(command_id: str, params: dict[str, Any] | None = None) -> subprocess.CompletedProcess[str]:
    argv = LOCAL_COMMANDS.get(command_id)
    if not argv:
        typer.echo(f"unknown local command: {command_id}", err=True)
        raise typer.Exit(code=2)
    resolved = list(argv)
    for name in LOCAL_PARAM_ORDER.get(command_id, []):
        value = (params or {}).get(name)
        if isinstance(value, str) and value.strip():
            resolved.append(value.strip())
    return subprocess.run(resolved, capture_output=True, text=True, check=False)


def _dispatch(command_id: str, params: dict[str, Any] | None = None, caller: str = "OperatorLocal") -> int:
    if gateway_ready() and command_id not in STACK_UP_DOWN:
        payload = _http_json(
            "POST",
            f"{GATEWAY_URL}/v1/control/dispatch",
            {"command": command_id, "params": params or {}},
            caller,
        )
        _print_json(payload)
        return 0 if bool(payload.get("ok", True)) else 1

    result = _local_run(command_id, params)
    if result.stdout:
        typer.echo(result.stdout.rstrip())
    if result.stderr:
        typer.echo(result.stderr.rstrip(), err=True)
    return result.returncode


@gateway_app.command("health")
def gateway_health() -> None:
    payload = _http_json("GET", f"{GATEWAY_URL}/health", None, "OperatorLocal")
    _print_json(payload)


@gateway_app.command("up")
def gateway_up() -> None:
    raise typer.Exit(code=_dispatch("gateway.up"))


@gateway_app.command("down")
def gateway_down() -> None:
    raise typer.Exit(code=_dispatch("gateway.down"))


@gateway_app.command("status")
def gateway_status() -> None:
    raise typer.Exit(code=_dispatch("gateway.status"))


@gateway_app.command("dispatch")
def gateway_dispatch(
    command_id: str = typer.Argument(..., help="Gateway command id."),
    params: str = typer.Option("{}", "--params", help="JSON params object."),
    caller: str = typer.Option("OperatorLocal", "--caller", help="Caller identity."),
) -> None:
    try:
        parsed = json.loads(params)
    except json.JSONDecodeError as exc:
        typer.echo(f"invalid params JSON: {exc}", err=True)
        raise typer.Exit(code=2) from exc
    raise typer.Exit(code=_dispatch(command_id, parsed, caller))


@stack_app.command("up")
def stack_up() -> None:
    raise typer.Exit(code=_dispatch("stack.up"))


@stack_app.command("down")
def stack_down() -> None:
    raise typer.Exit(code=_dispatch("stack.down"))


@stack_app.command("status")
def stack_status() -> None:
    raise typer.Exit(code=_dispatch("stack.status"))


@stack_app.command("tv")
def stack_tv(reset: bool = typer.Option(False, "--reset", help="Reset the TV layout session.")) -> None:
    command_id = "stack.tv.reset" if reset else "stack.tv"
    raise typer.Exit(code=_dispatch(command_id))


@room_app.command("open")
def room_open(
    target: str = typer.Argument(..., help="operation, commercial, archive, feedback, brain, radar"),
    layer: str | None = typer.Option(None, "--layer", help="Optional room layer to preselect."),
) -> None:
    command_id = ROOM_COMMANDS.get(target.strip().lower())
    if not command_id:
        typer.echo(f"unknown room target: {target}", err=True)
        raise typer.Exit(code=2)
    params = {"layer": layer} if layer else None
    raise typer.Exit(code=_dispatch(command_id, params))


@mcp_app.command("run")
def mcp_run(
    service: str = typer.Argument(..., help="linux, time, voice"),
    action: str = typer.Argument(..., help="up, down, status"),
) -> None:
    service_map = MCP_COMMANDS.get(service.strip().lower())
    if not service_map:
        typer.echo(f"unknown mcp service: {service}", err=True)
        raise typer.Exit(code=2)
    command_id = service_map.get(action.strip().lower())
    if not command_id:
        typer.echo(f"unknown mcp action: {action}", err=True)
        raise typer.Exit(code=2)
    raise typer.Exit(code=_dispatch(command_id))


@station_app.command("map")
def station_map() -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "bin/station-map.py"), "--pretty"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.stdout:
        typer.echo(result.stdout.rstrip())
    if result.stderr:
        typer.echo(result.stderr.rstrip(), err=True)
    raise typer.Exit(code=result.returncode)


@dashboard_app.command("tv")
def dashboard_tv() -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "bin/vxstation_dashboard.py")],
        check=False,
    )
    raise typer.Exit(code=result.returncode)


@dashboard_app.command("room")
def dashboard_room(
    target: str = typer.Argument(..., help="operation, commercial, archive, feedback, brain, radar"),
    layer: str | None = typer.Option(None, "--layer", help="Optional room layer to preselect."),
) -> None:
    command_id = ROOM_COMMANDS.get(target.strip().lower())
    if not command_id:
        typer.echo(f"unknown room target: {target}", err=True)
        raise typer.Exit(code=2)
    params = {"layer": layer} if layer else None
    raise typer.Exit(code=_dispatch(command_id, params))


@brain_app.command("status")
def brain_status() -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "bin/vxstation-brain-stack.py")],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.stdout:
        typer.echo(result.stdout.rstrip())
    if result.stderr:
        typer.echo(result.stderr.rstrip(), err=True)
    raise typer.Exit(code=result.returncode)


@brain_app.command("check")
def brain_check() -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "bin/vxstation-brain-stack.py"), "--check"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.stdout:
        typer.echo(result.stdout.rstrip())
    if result.stderr:
        typer.echo(result.stderr.rstrip(), err=True)
    raise typer.Exit(code=result.returncode)


if __name__ == "__main__":
    app()
