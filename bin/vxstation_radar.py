#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from textual.app import App, ComposeResult
from textual.containers import Grid, Horizontal, Vertical
from textual.widgets import Button, Footer, Header, Static


ROOT = Path("/home/t79/KITTY")
COMMAND_AUDIT = ROOT / "evidence/journal/command_bus.audit.jsonl"
MODULE_ACTIONS = ROOT / "evidence/journal/module_actions.jsonl"
ARCHIVE_AUDIT = ROOT / "evidence/journal/archive_room.audit.jsonl"
FEEDBACK_AUDIT = ROOT / "evidence/journal/feedback_cloud_vyrdx_room.audit.jsonl"
OPS_STATUS = ROOT / "OPERATION_ROOM/monitoring/latest_status.json"
COMMERCIAL_ENGINES = ROOT / "COMMERCIAL_ROOM/engine_registry.tsv"
COMMERCIAL_CONNECTORS = ROOT / "COMMERCIAL_ROOM/connector_registry.tsv"
ARCHIVE_ROOT = ROOT / "ARCHIVING_ROOM"
FEEDBACK_ROOT = ROOT / "FEEDBACK_CLOUD_VYRDX_ROOM"
STATION_MAP = ROOT / "bin/station-map.py"
CALENDAR_STATE = Path("/home/t79/AI_ROOM/state/calendar_state.json")

ROOMS: list[dict[str, Any]] = [
    {
        "slug": "brain",
        "title": "SZH Central Brain",
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
        "layers": ["control", "calendar", "maps", "power", "market", "mcp"],
    },
    {
        "slug": "radar",
        "title": "Radar",
        "layers": ["runtime", "bridges", "services", "archive"],
    },
    {
        "slug": "commercial",
        "title": "Commercial",
        "layers": ["receipts", "stamps", "accounting", "signals"],
    },
    {
        "slug": "archive",
        "title": "Archive",
        "layers": ["timeline", "evidence", "integrity", "frozen"],
    },
    {
        "slug": "feedback",
        "title": "Feedback",
        "layers": ["intake", "aggregation", "response", "outputs"],
    },
]


def room_definition(room_slug: str) -> dict[str, Any]:
    room = next((entry for entry in ROOMS if entry["slug"] == room_slug), None)
    if room is None:
        raise KeyError(f"unknown room: {room_slug}")
    return room


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return fallback


def read_jsonl(path: Path, limit: int = 8) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    try:
        for line in path.read_text("utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    except Exception:
        return []
    return rows[-limit:]


def read_tsv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    lines = [line.rstrip("\n") for line in path.read_text("utf-8").splitlines() if line.strip()]
    if not lines:
        return []
    headers = lines[0].split("\t")
    rows: list[dict[str, str]] = []
    for line in lines[1:]:
        values = line.split("\t")
        rows.append(dict(zip(headers, values)))
    return rows


def command_exists(target: str) -> bool:
    if "/" in target:
        path = Path(target)
        return path.exists() and path.is_file()
    return shutil.which(target) is not None


def station_snapshot() -> dict[str, Any]:
    result = subprocess.run(
        [sys.executable, str(STATION_MAP)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return {}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}


def pretty_json(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True)


def trim_hash(value: str, length: int = 18) -> str:
    return value[:length] if value else ""


def latest_snapshot(path: Path) -> str:
    if not path.exists():
        return f"missing: {path}"
    try:
        text = path.read_text("utf-8").strip()
    except UnicodeDecodeError:
        text = path.read_bytes().decode("utf-8", "ignore").strip()
    return text[:4000] if text else f"empty: {path.name}"


def recent_command_receipts() -> str:
    rows = read_jsonl(COMMAND_AUDIT, limit=6)
    if not rows:
        return "No command receipts found."
    lines = ["Recent VXSTATION receipts"]
    for index, row in enumerate(reversed(rows), start=1):
        receipt = row.get("receipt", {}) or {}
        evidence = row.get("evidence", {}) or {}
        causal_hash = evidence.get("causal_hash") or evidence.get("prev_hash", "")
        lines.extend(
            [
                f"Receipt {index}",
                f"evidence_id={evidence.get('evidence_id', 'unknown')}",
                f"command_id={evidence.get('command_id', 'unknown')}",
                f"actor_id={evidence.get('actor_id', 'unknown')}",
                f"decision={evidence.get('decision', 'unknown')}",
                f"decision_reason={evidence.get('decision_reason', 'unknown')}",
                f"payload_hash={trim_hash(str(evidence.get('payload_hash', '')))}",
                f"causal_hash={trim_hash(str(causal_hash))}",
                f"timestamp={evidence.get('timestamp', row.get('timestamp', '?'))}",
                f"prev_hash={trim_hash(str(evidence.get('prev_hash', '')))}",
                f"record_hash={trim_hash(str(evidence.get('record_hash', '')))}",
                f"route={receipt.get('route', 'unknown')} accepted={receipt.get('accepted')}",
                "",
            ]
        )
    return "\n".join(lines)


def recent_stamps() -> str:
    rows = read_jsonl(COMMAND_AUDIT, limit=6)
    if not rows:
        return "No evidence stamps found."
    lines = ["Latest evidence stamps"]
    for index, row in enumerate(reversed(rows), start=1):
        evidence = row.get("evidence", {}) or {}
        lines.extend(
            [
                f"Stamp {index}",
                f"evidence_id={evidence.get('evidence_id', 'unknown')}",
                f"timestamp={evidence.get('timestamp', row.get('timestamp', '?'))}",
                f"fingerprint={trim_hash(str(evidence.get('fingerprint', '')))}",
                f"payload_hash={trim_hash(str(evidence.get('payload_hash', '')))}",
                f"prev_hash={trim_hash(str(evidence.get('prev_hash', '')))}",
                f"record_hash={trim_hash(str(evidence.get('record_hash', '')))}",
                f"policy={evidence.get('policy_version', 'unknown')}",
                "",
            ]
        )
    return "\n".join(lines)


def accounting_status() -> str:
    rows = read_tsv(COMMERCIAL_ENGINES)
    targets = [row for row in rows if row.get("engine_id") in {"beancount_ledger", "fava_dashboard"}]
    if not targets:
        return "Commercial accounting registry is missing."
    lines = ["Commercial accounting mirror"]
    for row in targets:
        target = row.get("binary_or_home", "")
        lines.append(
            " | ".join(
                [
                    row.get("engine_id", "unknown"),
                    f"state={row.get('state', 'unknown')}",
                    f"installed={command_exists(target)}",
                    target,
                ]
            )
        )
    lines.append("Note: dedicated VYRDX ledger feed is not mirrored into KITTY yet.")
    return "\n".join(lines)


def commercial_signals() -> str:
    engine_rows = read_tsv(COMMERCIAL_ENGINES)
    connector_rows = read_tsv(COMMERCIAL_CONNECTORS)
    lines = ["Commercial room signal map", "", "Engines"]
    for row in engine_rows[:6]:
        lines.append(
            f"{row.get('engine_id')} | {row.get('state')} | {row.get('primary_use')}"
        )
    lines.append("")
    lines.append("Connectors")
    for row in connector_rows[:6]:
        lines.append(
            f"{row.get('connector_id')} | {row.get('state')} | {row.get('source')} -> {row.get('target')}"
        )
    return "\n".join(lines)


def archive_timeline() -> str:
    rows = read_jsonl(ARCHIVE_AUDIT, limit=10)
    if not rows:
        return "No archive timeline events found."
    return "\n".join(
        ["Archive timeline"]
        + [f"{row.get('timestamp', '?')} | {row.get('event', 'unknown')} | {row.get('details', '')}" for row in rows]
    )


def archive_evidence() -> str:
    frozen = sorted((ARCHIVE_ROOT / "frozen_records").glob("*"))
    baselines = sorted((ARCHIVE_ROOT / "baselines").glob("*"))
    lines = ["Archive evidence surface", "", "Frozen records"]
    lines.extend([path.name for path in frozen[-8:]] or ["none"])
    lines.append("")
    lines.append("Baselines")
    lines.extend([path.name for path in baselines[-4:]] or ["none"])
    return "\n".join(lines)


def archive_integrity() -> str:
    baseline = ARCHIVE_ROOT / "baselines/current_baseline.sha256"
    station = ARCHIVE_ROOT / "runtime/state/station_snapshot_latest.json"
    lines = ["Archive integrity"]
    lines.append(f"current_baseline={'present' if baseline.exists() else 'missing'}")
    lines.append(f"station_snapshot={'present' if station.exists() else 'missing'}")
    rows = read_jsonl(ARCHIVE_AUDIT, limit=4)
    for row in rows:
        lines.append(f"{row.get('timestamp', '?')} | {row.get('event', 'unknown')} | {row.get('details', '')}")
    return "\n".join(lines)


def archive_frozen() -> str:
    frozen = sorted((ARCHIVE_ROOT / "frozen_records").glob("*"))
    if not frozen:
        return "No frozen archive records."
    return "\n".join(["Latest frozen archive records"] + [path.name for path in frozen[-12:]])


def feedback_intake() -> str:
    return latest_snapshot(FEEDBACK_ROOT / "cloud_feedback_intake/live_feedback_intake_snapshot.json")


def feedback_aggregation() -> str:
    return latest_snapshot(FEEDBACK_ROOT / "signal_aggregation/live_signal_aggregation_snapshot.json")


def feedback_response() -> str:
    return latest_snapshot(FEEDBACK_ROOT / "ai_service_response_layer/live_ai_service_response_snapshot.json")


def feedback_outputs() -> str:
    return latest_snapshot(FEEDBACK_ROOT / "vyrdx_facing_feedback_outputs/live_vyrdx_feedback_output_snapshot.json")


def engine_rows(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    return snapshot.get("central_brain", {}).get("engines", [])


def engine_status(snapshot: dict[str, Any], engine_id: str) -> str:
    for row in engine_rows(snapshot):
        if row.get("engine_id") == engine_id:
            return str(row.get("color_state", "unknown"))
    return "unknown"


def service_summary(snapshot: dict[str, Any], key: str) -> str:
    payload = snapshot.get("services", {}).get(key, {})
    health = payload.get("health") or {}
    detail = (
        str(health.get("status", "")).strip()
        or str(health.get("service", "")).strip()
        or str(payload.get("state", "")).strip()
        or "unknown"
    )
    return f"{key} | {payload.get('color_state', 'red')} | {detail}"


def brain_ops(snapshot: dict[str, Any]) -> str:
    lines = ["Central brain ops plane"]
    for engine_id in ("ops_dispatch", "commercial_dispatch", "feedback_dispatch", "archive_dispatch"):
        lines.append(f"{engine_id} | {engine_status(snapshot, engine_id)}")
    lines.append("")
    lines.append(service_summary(snapshot, "agentgateway"))
    lines.append(service_summary(snapshot, "mcp_linux_admin"))
    return "\n".join(lines)


def brain_system(snapshot: dict[str, Any]) -> str:
    central = snapshot.get("central_brain", {})
    gateway = central.get("gateway", {})
    nervous = central.get("nervous_system", {})
    power = central.get("power_control", {})
    lines = ["Central system fabric"]
    lines.append(f"central_brain={central.get('color_state', 'unknown')}")
    lines.append(f"gateway={gateway.get('color_state', 'unknown')}")
    lines.append(f"nervous_system={nervous.get('color_state', 'unknown')}")
    lines.append(f"power_control={power.get('color_state', 'unknown')}")
    lines.append(f"bridge_nodes={len(snapshot.get('bridge_nodes', []))}")
    return "\n".join(lines)


def brain_policy(snapshot: dict[str, Any]) -> str:
    denied = [
        row
        for row in read_jsonl(COMMAND_AUDIT, limit=12)
        if not bool((row.get("receipt") or {}).get("accepted"))
    ]
    lines = ["Policy surface"]
    lines.append(f"policy_router={engine_status(snapshot, 'policy_router')}")
    lines.append(f"security_guard={engine_status(snapshot, 'security_guard')}")
    lines.append(f"route_target={snapshot.get('vxstation_control', {}).get('route_target', 'unknown')}")
    lines.append("")
    lines.append("Latest denials")
    lines.extend(
        [
            f"{row.get('timestamp', '?')} | {((row.get('evidence') or {}).get('decision_reason', 'unknown'))}"
            for row in reversed(denied[-4:])
        ]
        or ["none"]
    )
    return "\n".join(lines)


def brain_trust_closure(snapshot: dict[str, Any]) -> str:
    targets = snapshot.get("vxstation_control", {}).get("cloud_target_manager", {}).get("targets", [])
    nodes = snapshot.get("bridge_nodes", [])
    lines = ["Trust closure"]
    lines.append("Cloud targets")
    lines.extend(
        [f"{row.get('target_id')} | {row.get('profile')} | {row.get('color_state')}" for row in targets]
        or ["none"]
    )
    lines.append("")
    lines.append("Bridge nodes")
    lines.extend(
        [f"{node.get('node_id')} | {node.get('status')} | {node.get('trust_level')}" for node in nodes]
        or ["none"]
    )
    return "\n".join(lines)


def brain_seal_readiness(snapshot: dict[str, Any]) -> str:
    radar = snapshot.get("radar", {})
    baseline = ARCHIVE_ROOT / "baselines/current_baseline.sha256"
    station = ARCHIVE_ROOT / "runtime/state/station_snapshot_latest.json"
    lines = ["Seal readiness"]
    lines.append(f"audit_chain={engine_status(snapshot, 'audit_chain')}")
    lines.append(f"baseline={'present' if baseline.exists() else 'missing'}")
    lines.append(f"station_snapshot={'present' if station.exists() else 'missing'}")
    lines.append(
        f"command_gate accepted={radar.get('command_gate', {}).get('accepted', 0)} denied={radar.get('command_gate', {}).get('denied', 0)}"
    )
    return "\n".join(lines)


def brain_commercial(snapshot: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"commercial_dispatch={engine_status(snapshot, 'commercial_dispatch')}",
            "",
            accounting_status(),
            "",
            commercial_signals(),
        ]
    )


def brain_market(snapshot: dict[str, Any]) -> str:
    lines = ["Market and analytics surface"]
    for key in ("clickhouse", "netdata_cloud"):
        lines.append(service_summary(snapshot, key))
    lines.append("")
    for row in snapshot.get("operation_room", {}).get("entries", []):
        if row.get("entry_id") in {"tenderly_cli", "octosql_cli", "steampipe_cli"}:
            lines.append(f"{row.get('entry_id')} | {row.get('color_state')} | {row.get('detail')}")
    return "\n".join(lines)


def brain_feedback_ai(snapshot: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"feedback_dispatch={engine_status(snapshot, 'feedback_dispatch')}",
            "",
            feedback_response(),
        ]
    )


def brain_evidence(snapshot: dict[str, Any]) -> str:
    return "\n".join([recent_command_receipts(), "", recent_stamps()])


def brain_campaign(snapshot: dict[str, Any]) -> str:
    return "\n".join(
        [
            "Campaign and delivery surface",
            "",
            feedback_outputs(),
        ]
    )


def operation_control(snapshot: dict[str, Any]) -> str:
    lines = ["Operation control plane"]
    lines.append(f"overall={snapshot.get('operation_room', {}).get('color_state', 'unknown')}")
    lines.append(f"ops_status={read_json(OPS_STATUS, {}).get('overall_status', 'unknown')}")
    lines.append("")
    for row in snapshot.get("operation_room", {}).get("entries", []):
        lines.append(f"{row.get('entry_id')} | {row.get('color_state')} | {row.get('detail')}")
    return "\n".join(lines)


def operation_calendar(snapshot: dict[str, Any]) -> str:
    doc = read_json(CALENDAR_STATE, {})
    entries = doc.get("entries", []) if isinstance(doc.get("entries"), list) else []
    lines = ["Operation calendar"]
    lines.append(service_summary(snapshot, "mcp_time_calendar_agent"))
    lines.append(f"calcure={'present' if (ROOT / '.venv/bin/calcure').exists() else 'missing'}")
    lines.append("")
    lines.append(f"calendar_updated_at={doc.get('updated_at', 'unknown')}")
    lines.extend(
        [
            f"{entry.get('atUtc', '?')} | {entry.get('title', 'untitled')}"
            for entry in entries[:6]
        ]
        or ["no entries"]
    )
    return "\n".join(lines)


def operation_maps(snapshot: dict[str, Any]) -> str:
    lines = ["Operation map"]
    lines.append("Lanes")
    lines.extend(
        [f"{lane.get('label')} | online={lane.get('online')}" for lane in snapshot.get("lanes", [])]
        or ["none"]
    )
    lines.append("")
    lines.append("Bridge nodes")
    lines.extend(
        [f"{node.get('node_id')} | {node.get('status')} | {node.get('endpoint')}" for node in snapshot.get("bridge_nodes", [])]
        or ["none"]
    )
    return "\n".join(lines)


def operation_power(snapshot: dict[str, Any]) -> str:
    central = snapshot.get("central_brain", {})
    lines = ["Power and local control"]
    lines.append(service_summary(snapshot, "mcp_linux_admin"))
    lines.append(service_summary(snapshot, "agentgateway"))
    lines.append(f"power_control={central.get('power_control', {}).get('color_state', 'unknown')}")
    return "\n".join(lines)


def operation_market(snapshot: dict[str, Any]) -> str:
    return brain_market(snapshot)


def operation_mcp(snapshot: dict[str, Any]) -> str:
    return "\n".join(
        [
            "MCP room bindings",
            service_summary(snapshot, "mcp_linux_admin"),
            service_summary(snapshot, "mcp_time_calendar_agent"),
            service_summary(snapshot, "mcp_voice_agent"),
        ]
    )


def radar_runtime(snapshot: dict[str, Any]) -> str:
    radar = snapshot.get("radar", {})
    ops = read_json(OPS_STATUS, {})
    lines = ["Live VYRDX runtime"]
    lines.append(f"overall_status={radar.get('overall_status', 'unknown')}")
    lines.append(f"lanes_online={radar.get('lanes_online', 0)}/{radar.get('lanes_total', 0)}")
    lines.append(f"ops_status={ops.get('overall_status', 'unknown')}")
    for lane in snapshot.get("lanes", []):
        lines.append(f"{lane.get('label')} | online={lane.get('online')}")
    return "\n".join(lines)


def radar_bridges(snapshot: dict[str, Any]) -> str:
    nodes = snapshot.get("bridge_nodes", [])
    if not nodes:
        return "No bridge nodes found."
    return "\n".join(
        ["Bridge nodes"]
        + [
            f"{node.get('node_id')} | {node.get('status')} | {node.get('service_name')} | {node.get('endpoint')}"
            for node in nodes
        ]
    )


def radar_services(snapshot: dict[str, Any]) -> str:
    rows = snapshot.get("vxstation_control", {}).get("server_registry", {}).get("servers", [])
    return "\n".join(
        ["Control-plane services"]
        + [f"{row.get('server_id')} | {row.get('color_state')} | {row.get('detail')}" for row in rows]
    )


def radar_archive(snapshot: dict[str, Any]) -> str:
    command_rows = read_jsonl(COMMAND_AUDIT, limit=4)
    module_rows = read_jsonl(MODULE_ACTIONS, limit=4)
    lines = ["Archive + audit radar", "", "Command receipts"]
    lines.extend(
        [
            f"{row.get('timestamp', '?')} | accepted={(row.get('receipt') or {}).get('accepted')} | route={(row.get('receipt') or {}).get('route')}"
            for row in command_rows
        ]
        or ["none"]
    )
    lines.append("")
    lines.append("Module actions")
    lines.extend(
        [
            f"{row.get('timestamp', '?')} | module={row.get('module')} | action={row.get('action')}"
            for row in module_rows
        ]
        or ["none"]
    )
    return "\n".join(lines)


LAYER_RENDERERS = {
    ("brain", "ops"): lambda snapshot: brain_ops(snapshot),
    ("brain", "system"): lambda snapshot: brain_system(snapshot),
    ("brain", "policy"): lambda snapshot: brain_policy(snapshot),
    ("brain", "trust_closure"): lambda snapshot: brain_trust_closure(snapshot),
    ("brain", "seal_readiness"): lambda snapshot: brain_seal_readiness(snapshot),
    ("brain", "commercial"): lambda snapshot: brain_commercial(snapshot),
    ("brain", "market"): lambda snapshot: brain_market(snapshot),
    ("brain", "feedback_ai"): lambda snapshot: brain_feedback_ai(snapshot),
    ("brain", "evidence"): lambda snapshot: brain_evidence(snapshot),
    ("brain", "campaign"): lambda snapshot: brain_campaign(snapshot),
    ("operation", "control"): lambda snapshot: operation_control(snapshot),
    ("operation", "calendar"): lambda snapshot: operation_calendar(snapshot),
    ("operation", "maps"): lambda snapshot: operation_maps(snapshot),
    ("operation", "power"): lambda snapshot: operation_power(snapshot),
    ("operation", "market"): lambda snapshot: operation_market(snapshot),
    ("operation", "mcp"): lambda snapshot: operation_mcp(snapshot),
    ("commercial", "receipts"): lambda snapshot: recent_command_receipts(),
    ("commercial", "stamps"): lambda snapshot: recent_stamps(),
    ("commercial", "accounting"): lambda snapshot: accounting_status(),
    ("commercial", "signals"): lambda snapshot: commercial_signals(),
    ("archive", "timeline"): lambda snapshot: archive_timeline(),
    ("archive", "evidence"): lambda snapshot: archive_evidence(),
    ("archive", "integrity"): lambda snapshot: archive_integrity(),
    ("archive", "frozen"): lambda snapshot: archive_frozen(),
    ("feedback", "intake"): lambda snapshot: feedback_intake(),
    ("feedback", "aggregation"): lambda snapshot: feedback_aggregation(),
    ("feedback", "response"): lambda snapshot: feedback_response(),
    ("feedback", "outputs"): lambda snapshot: feedback_outputs(),
    ("radar", "runtime"): lambda snapshot: radar_runtime(snapshot),
    ("radar", "bridges"): lambda snapshot: radar_bridges(snapshot),
    ("radar", "services"): lambda snapshot: radar_services(snapshot),
    ("radar", "archive"): lambda snapshot: radar_archive(snapshot),
}


class VxstationRadarApp(App[None]):
    CSS = """
    Screen {
        layout: vertical;
        background: #03111a;
        color: #d8f4ff;
    }

    #summary {
        height: 9;
        margin: 1 1 0 1;
        border: heavy #1fb7ff;
        background: #071824;
        padding: 1 2;
    }

    #body {
        height: 1fr;
        margin: 1;
    }

    #rooms {
        width: 44;
        border: heavy #28d7ff;
        background: #06151f;
        padding: 1;
    }

    .room-card {
        border: round #ffb703;
        margin-bottom: 1;
        padding: 1;
    }

    .layer-button {
        width: 100%;
        margin-top: 1;
    }

    #detail {
        border: heavy #9ef01a;
        background: #09131b;
        padding: 1 2;
    }
    """

    BINDINGS = [("q", "quit", "Quit"), ("r", "refresh", "Refresh")]

    def __init__(self, room: str = "radar", layer: str = "") -> None:
        super().__init__()
        room_info = room_definition(room)
        initial_layer = layer if layer in room_info["layers"] else room_info["layers"][0]
        self._selected: tuple[str, str] = (room_info["slug"], initial_layer)
        self._snapshot: dict[str, Any] = {}

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        yield Static("", id="summary")
        with Horizontal(id="body"):
            with Vertical(id="rooms"):
                for room in ROOMS:
                    with Vertical(classes="room-card"):
                        yield Static(f"[bold #8be9fd]{room['title']}[/bold #8be9fd]")
                        for layer in room["layers"]:
                            yield Button(
                                f"{room['title']} / {layer}",
                                id=f"layer-{room['slug']}-{layer}",
                                classes="layer-button",
                                variant="primary",
                            )
            yield Static("", id="detail")
        yield Footer()

    def on_mount(self) -> None:
        self.title = "VXSTATION Radar"
        self.sub_title = "KITTY-local live VYRDX monitor"
        self._refresh()
        self.set_interval(3.0, self._refresh)

    def action_refresh(self) -> None:
        self._refresh()

    def _summary_text(self) -> str:
        radar = self._snapshot.get("radar", {})
        server_registry = self._snapshot.get("vxstation_control", {}).get("server_registry", {})
        return "\n".join(
            [
                "[bold #ffffff]KITTY Radar[/bold #ffffff]",
                f"overall_status={radar.get('overall_status', 'unknown')}",
                f"lanes={radar.get('lanes_online', 0)}/{radar.get('lanes_total', 0)}",
                f"services_green={server_registry.get('green_total', 0)} services_red={server_registry.get('red_total', 0)}",
                f"selected={self._selected[0]}/{self._selected[1]}",
            ]
        )

    def _detail_text(self) -> str:
        renderer = LAYER_RENDERERS.get(self._selected)
        if renderer is None:
            return f"No renderer for {self._selected[0]}/{self._selected[1]}"
        body = renderer(self._snapshot)
        return f"[bold #ffffff]{self._selected[0].upper()} / {self._selected[1].upper()}[/bold #ffffff]\n\n{body}"

    def _refresh(self) -> None:
        self._snapshot = station_snapshot()
        self.query_one("#summary", Static).update(self._summary_text())
        self.query_one("#detail", Static).update(self._detail_text())

    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id or ""
        if not button_id.startswith("layer-"):
            return
        _, room, layer = button_id.split("-", 2)
        self._selected = (room, layer)
        self._refresh()


def main() -> None:
    parser = argparse.ArgumentParser(description="VXSTATION room and radar surface")
    parser.add_argument("--room", choices=[room["slug"] for room in ROOMS], default="radar")
    parser.add_argument("--layer", default="", help="Optional layer to preselect for the room.")
    args = parser.parse_args()
    VxstationRadarApp(room=args.room, layer=args.layer).run()


if __name__ == "__main__":
    main()
