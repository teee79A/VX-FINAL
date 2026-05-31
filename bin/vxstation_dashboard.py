#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from urllib import error, request

from textual.app import App, ComposeResult
from textual.containers import Grid, Horizontal, Vertical
from textual.widgets import Button, Footer, Header, Static


ROOT = Path("/home/t79/KITTY")
GATEWAY_URL = "http://127.0.0.1:46080"
TOKEN_FILE = ROOT / "state/agentgateway/gateway.token"
COMMAND_AUDIT_FILE = ROOT / "evidence" / "journal" / "command_bus.audit.jsonl"
ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
MEDIAMTX_FALLBACK = Path("/home/t79/.local/bin/mediamtx")
ZENITH_FALLBACK = Path("/home/t79/.local/bin/zenith")
MEDIA_PORTS = {
    "rtsp": 8554,
    "rtmp": 1935,
    "hls": 8888,
    "webrtc": 8889,
}
TOOL_CACHE: dict[str, Any] = {"expires_at": 0.0, "snapshot": {}}

ROOMS: list[dict[str, Any]] = [
    {
        "slug": "brain",
        "title": "SZH Central Brain",
        "command": "room.central_brain.open",
        "layers": [
            "ops",
            "system",
            "policy",
            "trust_closure",
            "seal_readiness",
            "commercial",
            "market",
            "feedback_ai",
            "evidence",
            "campaign",
        ],
    },
    {
        "slug": "operation",
        "title": "Operation Room",
        "command": "room.operation.open",
        "layers": ["control", "calendar", "maps", "power", "market", "mcp"],
    },
    {
        "slug": "radar",
        "title": "Radar",
        "command": "room.radar.open",
        "layers": ["runtime", "bridges", "services", "archive"],
    },
    {
        "slug": "commercial",
        "title": "Commercial Room",
        "command": "room.commercial.open",
        "layers": ["receipts", "stamps", "accounting", "signals"],
    },
    {
        "slug": "archive",
        "title": "Archiving Room",
        "command": "room.archive.open",
        "layers": ["timeline", "evidence", "integrity", "frozen"],
    },
    {
        "slug": "feedback",
        "title": "Feedback Cloud",
        "command": "room.feedback.open",
        "layers": ["intake", "aggregation", "response", "outputs"],
    },
    {
        "slug": "tv",
        "title": "TV Surface",
        "command": "stack.tv",
        "layers": ["dashboard", "rooms", "glass", "signals"],
    },
]

SERVICE_KEYS = [
    "agentgateway",
    "mcp_linux_admin",
    "mcp_time_calendar_agent",
    "mcp_voice_agent",
    "netdata_cloud",
    "clickhouse",
]


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text).strip()


def resolve_binary(name: str, fallback: Path | None = None) -> str | None:
    path = shutil.which(name)
    if path:
        return path
    if fallback and fallback.exists():
        return str(fallback)
    return None


def run_output(argv: list[str], timeout: float = 5.0, env: dict[str, str] | None = None) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
            env=env,
        )
    except Exception as exc:  # noqa: BLE001
        return (False, str(exc))
    raw = result.stdout or result.stderr
    cleaned = strip_ansi(raw)
    first_line = next((line.strip() for line in cleaned.splitlines() if line.strip()), "")
    return (result.returncode == 0, first_line)


def process_running(pattern: str) -> bool:
    result = subprocess.run(
        ["pgrep", "-af", pattern],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and bool(result.stdout.strip())


def port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def engine_color(snapshot: dict[str, Any], engine_id: str) -> str:
    engines = snapshot.get("central_brain", {}).get("engines", [])
    for engine in engines:
        if engine.get("engine_id") == engine_id:
            return str(engine.get("color_state", "red"))
    return "red"


def tool_snapshot() -> dict[str, Any]:
    now = time.time()
    if now < float(TOOL_CACHE["expires_at"]):
        return TOOL_CACHE["snapshot"]

    notcurses_ok, notcurses_line = run_output(
        ["notcurses-info"],
        env={**os.environ, "TERM": os.environ.get("TERM", "xterm-256color")},
    )
    mediamtx_path = resolve_binary("mediamtx", MEDIAMTX_FALLBACK)
    mediamtx_ok, mediamtx_version = run_output([mediamtx_path, "--version"]) if mediamtx_path else (False, "missing")
    zenith_path = resolve_binary("zenith", ZENITH_FALLBACK)
    zenith_ok, zenith_version = run_output([zenith_path, "--version"]) if zenith_path else (False, "missing")
    if zenith_ok and zenith_version.replace(".", "").isdigit():
        zenith_version = f"v{zenith_version}"
    snapshot = {
        "notcurses": {
            "installed": bool(resolve_binary("notcurses-info")),
            "ok": notcurses_ok,
            "version": notcurses_line or "unknown",
            "python_binding": False,
        },
        "mediamtx": {
            "installed": bool(mediamtx_path),
            "ok": mediamtx_ok,
            "version": mediamtx_version or "unknown",
            "running": process_running("mediamtx"),
            "ports": {name: port_open("127.0.0.1", port) for name, port in MEDIA_PORTS.items()},
            "path": mediamtx_path,
        },
        "zenith": {
            "installed": bool(zenith_path),
            "ok": zenith_ok,
            "version": zenith_version or "unknown",
            "running": process_running("zenith"),
            "path": zenith_path,
        },
    }
    TOOL_CACHE["expires_at"] = now + 5.0
    TOOL_CACHE["snapshot"] = snapshot
    return snapshot


def _token() -> str:
    if not TOKEN_FILE.exists():
        return ""
    return TOKEN_FILE.read_text("utf-8").strip()


def gateway_dispatch(command_id: str, caller: str = "OperatorLocal") -> dict[str, Any]:
    token = _token()
    payload = json.dumps({"command": command_id, "params": {}}).encode("utf-8")
    req = request.Request(
        f"{GATEWAY_URL}/v1/control/dispatch",
        method="POST",
        data=payload,
        headers={
            "content-type": "application/json",
            "Authorization": f"Bearer {token}",
            "X-VXSTATION-Caller": caller,
        },
    )
    try:
        with request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        return {"ok": False, "error": raw or f"http_{exc.code}", "status": exc.code}
    except error.URLError as exc:
        return {"ok": False, "error": str(exc)}


def station_snapshot() -> dict[str, Any]:
    result = subprocess.run(
        [sys.executable, str(ROOT / "bin/station-map.py")],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return {
            "radar": {"overall_status": "red", "lanes_online": 0, "lanes_total": 0},
            "vxstation_control": {"color_state": "red"},
            "central_brain": {"color_state": "red"},
            "operation_room": {"color_state": "red"},
            "services": {},
            "bridge_nodes": [],
        }
    return json.loads(result.stdout)


def recent_audit_events(limit: int = 8) -> list[dict[str, Any]]:
    if not COMMAND_AUDIT_FILE.exists():
        return []
    try:
        lines = COMMAND_AUDIT_FILE.read_text("utf-8", errors="ignore").splitlines()[-limit:]
    except OSError:
        return []

    events: list[dict[str, Any]] = []
    for line in lines:
        try:
            decoded = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(decoded, dict):
            events.append(decoded)
    return events


def status_chip(ok: bool, label: str) -> str:
    color = "black on #3ddc97" if ok else "white on #b00020"
    return f"[{color}] {label.upper()} [/{color}]"


def format_room_card(room: dict[str, Any], snapshot: dict[str, Any]) -> str:
    room_title = room["title"]
    layers = ", ".join(room["layers"])
    if room["slug"] == "brain":
        ok = snapshot.get("central_brain", {}).get("color_state") == "green"
    elif room["slug"] == "operation":
        ok = snapshot.get("operation_room", {}).get("color_state") == "green"
    elif room["slug"] == "radar":
        ok = snapshot.get("radar", {}).get("overall_status") == "green"
    elif room["slug"] == "commercial":
        ok = engine_color(snapshot, "commercial_dispatch") == "green"
    elif room["slug"] == "archive":
        ok = engine_color(snapshot, "archive_dispatch") == "green"
    elif room["slug"] == "feedback":
        ok = engine_color(snapshot, "feedback_dispatch") == "green"
    elif room["slug"] == "tv":
        tools = tool_snapshot()
        ok = (
            engine_color(snapshot, "video_runtime_core") == "green"
            and tools["notcurses"]["installed"]
            and tools["zenith"]["installed"]
            and tools["mediamtx"]["installed"]
        )
    else:
        ok = snapshot.get("radar", {}).get("overall_status") == "green"
    return "\n".join(
        [
            f"[bold #8be9fd]{room_title}[/bold #8be9fd]  {status_chip(ok, 'ready' if ok else 'hold')}",
            f"[#8aa4b8]Layers[/#8aa4b8]  {layers}",
            f"[#ffcc66]Action[/#ffcc66]  click OPEN",
        ]
    )


def format_overview(snapshot: dict[str, Any]) -> str:
    radar = snapshot.get("radar", {})
    blockers = snapshot.get("vxstation_control", {}).get("server_registry", {}).get("red_total", 0)
    ops_blockers = snapshot.get("operation_room", {}).get("critical_red_total", 0)
    return "\n".join(
        [
            f"[bold #ffffff]VXSTATION TV[/bold #ffffff]  {status_chip(radar.get('overall_status') == 'green', str(radar.get('overall_status', 'unknown')))}",
            f"[#7dd3fc]Lanes[/#7dd3fc]  {radar.get('lanes_online', 0)}/{radar.get('lanes_total', 0)} online",
            f"[#7dd3fc]Gate[/#7dd3fc]   accepted={radar.get('command_gate', {}).get('accepted', 0)} denied={radar.get('command_gate', {}).get('denied', 0)}",
            f"[#7dd3fc]Control[/#7dd3fc]  {snapshot.get('vxstation_control', {}).get('color_state', 'unknown')}",
            f"[#7dd3fc]Brain[/#7dd3fc]    {snapshot.get('central_brain', {}).get('color_state', 'unknown')}",
            f"[#7dd3fc]Ops[/#7dd3fc]      {snapshot.get('operation_room', {}).get('color_state', 'unknown')}",
            f"[#ffcc66]Blockers[/#ffcc66] control={blockers} ops={ops_blockers}",
        ]
    )


def format_services(snapshot: dict[str, Any]) -> str:
    services = snapshot.get("services", {})
    lines = ["[bold #ffffff]Nervous System[/bold #ffffff]"]
    for key in SERVICE_KEYS:
        payload = services.get(key, {})
        ok = payload.get("color_state") == "green"
        name = key.replace("_", " ")
        detail = payload.get("state") or (payload.get("health") or {}).get("service") or "down"
        lines.append(f"{status_chip(ok, 'up' if ok else 'down')} [#8be9fd]{name}[/#8be9fd] [#8aa4b8]{detail}[/#8aa4b8]")
    return "\n".join(lines)


def format_layers(snapshot: dict[str, Any]) -> str:
    engines = snapshot.get("central_brain", {}).get("engines", [])
    lines = ["[bold #ffffff]CEO Layers[/bold #ffffff]"]
    for engine in engines[:10]:
        ok = engine.get("color_state") == "green"
        name = str(engine.get("engine_id", "")).replace("_", " ")
        observed = engine.get("observed_state", "unknown")
        lines.append(f"{status_chip(ok, observed)} [#8be9fd]{name}[/#8be9fd]")
    return "\n".join(lines)


def format_cloud(snapshot: dict[str, Any]) -> str:
    targets = snapshot.get("vxstation_control", {}).get("cloud_target_manager", {}).get("targets", [])
    lines = ["[bold #ffffff]Cloud Truth[/bold #ffffff]"]
    if not targets:
        lines.append(f"{status_chip(False, 'missing')} [#8aa4b8]no targets configured[/#8aa4b8]")
        return "\n".join(lines)

    for target in targets:
        ok = target.get("color_state") == "green"
        name = str(target.get("target_id", "cloud")).replace("_", " ")
        detail = str(target.get("detail", "")).strip() or str(target.get("profile", "unknown"))
        lines.append(
            f"{status_chip(ok, 'up' if ok else 'down')} [#8be9fd]{name}[/#8be9fd] [#8aa4b8]{detail}[/#8aa4b8]"
        )
    return "\n".join(lines)


def format_activity(snapshot: dict[str, Any], action_note: str = "") -> str:
    lines = ["[bold #ffffff]State Reason + Journal[/bold #ffffff]"]

    blockers: list[str] = []
    services = snapshot.get("vxstation_control", {}).get("server_registry", {}).get("servers", [])
    for service in services:
        if service.get("color_state") != "green":
            blockers.append(
                f"service {service.get('server_id')} :: {service.get('detail', 'unknown')}"
            )

    cloud_targets = snapshot.get("vxstation_control", {}).get("cloud_target_manager", {}).get("targets", [])
    for target in cloud_targets:
        if target.get("color_state") != "green":
            blockers.append(
                f"cloud {target.get('target_id')} :: {target.get('detail', 'unknown')}"
            )

    if blockers:
        lines.append(f"{status_chip(False, 'hold')} [#ffcc66]{blockers[0]}[/#ffcc66]")
        for blocker in blockers[1:4]:
            lines.append(f"[#8aa4b8]- {blocker}[/#8aa4b8]")
    else:
        lines.append(f"{status_chip(True, 'green')} [#8aa4b8]no active blockers[/#8aa4b8]")

    if action_note:
        lines.append(f"[#7dd3fc]Last action[/#7dd3fc] {action_note}")

    lines.append("")
    lines.append("[bold #8be9fd]Journal tail[/bold #8be9fd]")

    events = recent_audit_events()
    if not events:
        lines.append("[#8aa4b8]no audit events found[/#8aa4b8]")
        return "\n".join(lines)

    for event in events:
        evidence = event.get("evidence", {}) or {}
        receipt = event.get("receipt", {}) or {}
        timestamp = str(event.get("timestamp", ""))[-13:-1] or "unknown"
        accepted = bool(receipt.get("accepted"))
        decision = str(evidence.get("decision", "unknown")).lower()
        reason = str(evidence.get("decision_reason", "unknown"))
        route = str(receipt.get("route", "unknown"))
        lines.append(
            f"[#8aa4b8]{timestamp}[/#8aa4b8] {status_chip(accepted, decision)} [#ffcc66]{route}[/#ffcc66] {reason}"
        )

    return "\n".join(lines)


def format_terminal_stack() -> str:
    tools = tool_snapshot()
    notcurses = tools["notcurses"]
    installed = bool(notcurses.get("installed"))
    binding = "system" if notcurses.get("installed") else "missing"
    return "\n".join(
        [
            "[bold #ffffff]Terminal Canvas[/bold #ffffff]",
            f"{status_chip(installed, 'ready' if installed else 'missing')} [#8be9fd]notcurses[/#8be9fd]",
            f"[#8aa4b8]{notcurses.get('version', 'unknown')}[/#8aa4b8]",
            f"[#7dd3fc]Binding[/#7dd3fc] {binding}",
            "[#ffcc66]Run[/#ffcc66] vx-canvas",
        ]
    )


def format_media_stack(snapshot: dict[str, Any]) -> str:
    tools = tool_snapshot()
    mediamtx = tools["mediamtx"]
    ports = mediamtx.get("ports", {})
    open_ports = [name for name, ok in ports.items() if ok]
    media_engine_ok = engine_color(snapshot, "video_runtime_core") == "green"
    running = bool(mediamtx.get("running"))
    return "\n".join(
        [
            "[bold #ffffff]Media Fabric[/bold #ffffff]",
            f"{status_chip(bool(mediamtx.get('installed')), 'ready' if mediamtx.get('installed') else 'missing')} [#8be9fd]mediamtx[/#8be9fd]",
            f"[#8aa4b8]{mediamtx.get('version', 'unknown')}[/#8aa4b8]",
            f"[#7dd3fc]Runtime[/#7dd3fc] {'running' if running else 'idle'}  [#7dd3fc]engine[/#7dd3fc] {'green' if media_engine_ok else 'hold'}",
            f"[#7dd3fc]Ports[/#7dd3fc] {', '.join(open_ports) if open_ports else 'none open'}",
            "[#ffcc66]Run[/#ffcc66] vx-stream",
        ]
    )


def format_monitor_stack(snapshot: dict[str, Any]) -> str:
    tools = tool_snapshot()
    zenith = tools["zenith"]
    netdata_ok = snapshot.get("services", {}).get("netdata_cloud", {}).get("color_state") == "green"
    clickhouse_ok = snapshot.get("services", {}).get("clickhouse", {}).get("color_state") == "green"
    return "\n".join(
        [
            "[bold #ffffff]Ops Monitor[/bold #ffffff]",
            f"{status_chip(bool(zenith.get('installed')), 'ready' if zenith.get('installed') else 'missing')} [#8be9fd]zenith[/#8be9fd]",
            f"[#8aa4b8]{zenith.get('version', 'unknown')}[/#8aa4b8]",
            f"[#7dd3fc]Netdata[/#7dd3fc] {'green' if netdata_ok else 'hold'}  [#7dd3fc]ClickHouse[/#7dd3fc] {'green' if clickhouse_ok else 'hold'}",
            f"[#7dd3fc]Live[/#7dd3fc] {'active' if zenith.get('running') else 'standby'}",
            "[#ffcc66]Run[/#ffcc66] vx-monitor",
        ]
    )


class VxstationDashboardApp(App[None]):
    CSS = """
    Screen {
        layout: vertical;
        background: #02131b;
        color: #d8f4ff;
    }

    #hero {
        height: 12;
        margin: 0 1;
    }

    .hero-card {
        border: heavy #1fb7ff;
        background: #071b24;
        padding: 1 2;
        width: 1fr;
        margin-right: 1;
    }

    #telemetry {
        height: 10;
        margin: 0 1 1 1;
    }

    .telemetry-card {
        border: round #ffb703;
        background: #08141d;
        padding: 1 2;
        width: 1fr;
        margin-right: 1;
    }

    #rooms {
        layout: grid;
        grid-size: 4 2;
        grid-gutter: 1 1;
        height: 22;
        margin: 1;
    }

    .room-card {
        border: round #28d7ff;
        background: #051820;
        padding: 1;
    }

    .room-body {
        height: 1fr;
    }

    Button {
        width: 100%;
        margin-top: 1;
    }

    #activity {
        height: 1fr;
        margin: 1;
        border: heavy #ffb703;
        background: #09131b;
    }
    """

    BINDINGS = [("q", "quit", "Quit"), ("r", "refresh", "Refresh")]

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="hero"):
            yield Static("", id="overview", classes="hero-card")
            yield Static("", id="services", classes="hero-card")
            yield Static("", id="layers", classes="hero-card")
        with Horizontal(id="telemetry"):
            yield Static("", id="terminal-stack", classes="telemetry-card")
            yield Static("", id="media-stack", classes="telemetry-card")
            yield Static("", id="monitor-stack", classes="telemetry-card")
        with Grid(id="rooms"):
            for room in ROOMS:
                with Vertical(classes="room-card"):
                    yield Static("", id=f"room-body-{room['slug']}", classes="room-body")
                    yield Button(f"OPEN {room['title'].upper()}", id=f"room-open-{room['slug']}", variant="primary")
        yield Static("", id="activity")
        yield Footer()

    def on_mount(self) -> None:
        self.title = "VXSTATION TV"
        self.sub_title = "KITTY Local High-Tech Dashboard"
        self._last_action_note = ""
        self._refresh()
        self.set_interval(2.0, self._refresh)

    def action_refresh(self) -> None:
        self._refresh()

    def _refresh(self) -> None:
        snapshot = station_snapshot()
        self.query_one("#overview", Static).update(format_overview(snapshot))
        self.query_one("#services", Static).update(format_services(snapshot))
        self.query_one("#layers", Static).update(format_cloud(snapshot))
        self.query_one("#terminal-stack", Static).update(format_terminal_stack())
        self.query_one("#media-stack", Static).update(format_media_stack(snapshot))
        self.query_one("#monitor-stack", Static).update(format_monitor_stack(snapshot))
        self.query_one("#activity", Static).update(format_activity(snapshot, self._last_action_note))
        for room in ROOMS:
            self.query_one(f"#room-body-{room['slug']}", Static).update(format_room_card(room, snapshot))

    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id or ""
        if not button_id.startswith("room-open-"):
            return
        slug = button_id.removeprefix("room-open-")
        room = next((room for room in ROOMS if room["slug"] == slug), None)
        if room is None:
            return
        result = gateway_dispatch(room["command"])
        ok = bool(result.get("ok"))
        self._last_action_note = (
            f"{time.strftime('%H:%M:%S')} "
            f"{'launched' if ok else 'failed'} "
            f"{room['title']} "
            f"{json.dumps(result, ensure_ascii=True)}"
        )
        self._refresh()


def main() -> None:
    VxstationDashboardApp().run()


if __name__ == "__main__":
    main()
