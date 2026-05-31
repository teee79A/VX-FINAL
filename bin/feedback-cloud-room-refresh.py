#!/usr/bin/env python3
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request

KITTY_ROOT = Path("/home/t79/KITTY")
ROOM_ROOT = KITTY_ROOT / "FEEDBACK_CLOUD_VYRDX_ROOM"
COMMAND_AUDIT_FILE = KITTY_ROOT / "evidence/journal/command_bus.audit.jsonl"
MODULE_ACTIONS_FILE = KITTY_ROOT / "evidence/journal/module_actions.jsonl"
ROOM_AUDIT_FILE = KITTY_ROOT / "evidence/journal/feedback_cloud_vyrdx_room.audit.jsonl"
STATION_MAP = KITTY_ROOT / "bin/station-map.py"

SECTION_FILES = {
    "cloud_feedback_intake": ROOM_ROOT / "cloud_feedback_intake/live_feedback_intake_snapshot.json",
    "feedback_processing": ROOM_ROOT / "feedback_processing/live_feedback_processing_snapshot.json",
    "signal_aggregation": ROOM_ROOT / "signal_aggregation/live_signal_aggregation_snapshot.json",
    "ai_service_response_layer": ROOM_ROOT / "ai_service_response_layer/live_ai_service_response_snapshot.json",
    "vyrdx_facing_feedback_outputs": ROOM_ROOT / "vyrdx_facing_feedback_outputs/live_vyrdx_feedback_output_snapshot.json",
}


def http_json(url: str) -> dict:
    try:
        with request.urlopen(url, timeout=3.0) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except (OSError, error.URLError, error.HTTPError, json.JSONDecodeError):
        return {}


def tail_lines(path: Path, limit: int = 20) -> list[str]:
    if not path.exists():
        return []
    lines = path.read_text("utf-8", errors="replace").splitlines()
    return lines[-limit:]


def filtered_command_events(limit: int = 12) -> list[dict]:
    events: list[dict] = []
    if not COMMAND_AUDIT_FILE.exists():
        return events
    for line in COMMAND_AUDIT_FILE.read_text("utf-8", errors="replace").splitlines():
        lowered = line.lower()
        if not any(token in lowered for token in ("feedback", "hook", "webhook", "signal", "ingress", "radar")):
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events[-limit:]


def run_station_map() -> dict:
    completed = subprocess.run(
        ["python3", str(STATION_MAP), "--pretty"],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: dict) -> None:
    ensure_parent(path)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    captured_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    station_map = run_station_map()
    agentgateway = http_json("http://127.0.0.1:46080/health")
    n8n = http_json("http://127.0.0.1:5678/healthz")
    time_calendar = http_json("http://127.0.0.1:8792/health")
    voice = http_json("http://127.0.0.1:8790/health")

    command_events = filtered_command_events()
    module_actions = tail_lines(MODULE_ACTIONS_FILE)
    room_audit_tail = tail_lines(ROOM_AUDIT_FILE)

    write_json(
        SECTION_FILES["cloud_feedback_intake"],
        {
            "captured_at": captured_at,
            "room": "FEEDBACK_CLOUD_VYRDX_ROOM",
            "section": "cloud_feedback_intake",
            "n8n_health": n8n,
            "agentgateway_health": agentgateway,
            "recent_feedback_events": command_events,
        },
    )

    write_json(
        SECTION_FILES["feedback_processing"],
        {
            "captured_at": captured_at,
            "room": "FEEDBACK_CLOUD_VYRDX_ROOM",
            "section": "feedback_processing",
            "module_actions_tail": module_actions,
            "process_targets": ["n8n", "hookdeck", "tenderly", "radar", "agentgateway.py"],
            "n8n_health": n8n,
        },
    )

    write_json(
        SECTION_FILES["signal_aggregation"],
        {
            "captured_at": captured_at,
            "room": "FEEDBACK_CLOUD_VYRDX_ROOM",
            "section": "signal_aggregation",
            "radar": station_map.get("radar", {}),
            "topology": station_map.get("topology", {}),
            "bridge_nodes": station_map.get("bridge_nodes", []),
        },
    )

    write_json(
        SECTION_FILES["ai_service_response_layer"],
        {
            "captured_at": captured_at,
            "room": "FEEDBACK_CLOUD_VYRDX_ROOM",
            "section": "ai_service_response_layer",
            "agentgateway_health": agentgateway,
            "time_calendar_health": time_calendar,
            "voice_health": voice,
            "module_actions_tail": module_actions,
        },
    )

    write_json(
        SECTION_FILES["vyrdx_facing_feedback_outputs"],
        {
            "captured_at": captured_at,
            "room": "FEEDBACK_CLOUD_VYRDX_ROOM",
            "section": "vyrdx_facing_feedback_outputs",
            "vxstation_control": station_map.get("vxstation_control", {}),
            "operation_room": station_map.get("operation_room", {}),
            "central_brain": station_map.get("central_brain", {}),
            "feedback_room_audit_tail": room_audit_tail,
        },
    )

    subprocess.run(
        ["bash", str(KITTY_ROOT / "room/feedback_cloud_vyrdx_room/runtime_status/render_runtime_status.sh")],
        check=True,
    )
    subprocess.run(
        ["bash", str(KITTY_ROOT / "room/feedback_cloud_vyrdx_room/evidence/render_evidence_linked_room_state.sh")],
        check=True,
    )

    print("feedback cloud room refreshed")


if __name__ == "__main__":
    main()
