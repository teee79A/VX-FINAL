#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request

KITTY_ROOT = Path("/home/t79/KITTY")
BIN_DIR = KITTY_ROOT / "bin"
ROOM_ROUTER_FILE = KITTY_ROOT / "data" / "vxstation_control" / "room_router.json"
ARCHIVE_BASELINE_FILE = KITTY_ROOT / "ARCHIVING_ROOM" / "baselines" / "current_baseline.sha256"
ARCHIVE_FROZEN_DIR = KITTY_ROOT / "ARCHIVING_ROOM" / "frozen_records"
STATION_MAP_FILE = BIN_DIR / "station-map.py"
OLD_ROOT = "/home/t79/VXSTATION/kitty"
EXPECTED_COMPOSE_FILE = "/home/t79/KITTY/docker/compose.yml"
ROOM_ROUTE_TARGET = "vxstation.bridge.dispatch"
CANONICAL_ROOMS = [
    "OPERATION_ROOM",
    "ARCHIVING_ROOM",
    "FEEDBACK_CLOUD_VYRDX_ROOM",
    "SZH_CENTRAL_BRAIN",
    "VYRDOX_HIDDEN_ROOT",
]
FEEDBACK_SECTIONS = [
    "cloud_feedback_intake",
    "feedback_processing",
    "signal_aggregation",
    "ai_service_response_layer",
    "vyrdx_facing_feedback_outputs",
]


@dataclass
class CheckResult:
    name: str
    status: str
    detail: str


def load_json(path: Path, fallback: dict | list | None = None):
    if fallback is None:
        fallback = {}
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return fallback


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def http_json(url: str, timeout: float = 2.0) -> dict:
    req = request.Request(url, method="GET")
    try:
        with request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except (OSError, error.URLError, error.HTTPError, json.JSONDecodeError):
        return {}


def run_json_command(command: list[str]) -> dict:
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError:
        return {}

    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError:
        return {}


def run_shell(command: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=check, capture_output=True, text=True)


def find_old_root_processes() -> list[dict]:
    completed = run_shell(["ps", "-eo", "pid=,args="])
    matches = []
    for raw_line in completed.stdout.splitlines():
        line = raw_line.strip()
        if not line or OLD_ROOT not in line:
            continue
        parts = line.split(maxsplit=1)
        if len(parts) != 2:
            continue
        try:
            pid = int(parts[0])
        except ValueError:
            continue
        matches.append({"pid": pid, "args": parts[1]})
    return matches


def section_file_count(section_name: str) -> int:
    section_root = KITTY_ROOT / "FEEDBACK_CLOUD_VYRDX_ROOM" / section_name
    if not section_root.exists():
        return 0
    return sum(1 for path in section_root.rglob("*") if path.is_file() and path.name != "README.md")


def analyze_room_router(doc: dict) -> tuple[list[str], list[str], list[dict]]:
    routes = doc.get("routes", [])
    rooms = []
    if not isinstance(routes, list):
        routes = []
    for route in routes:
        if not isinstance(route, dict):
            continue
        room = str(route.get("room", "")).strip()
        if room:
            rooms.append(room)
    missing = [room for room in CANONICAL_ROOMS if room not in rooms]
    extras = sorted(set(rooms) - set(CANONICAL_ROOMS))
    return missing, extras, routes


def ensure_hidden_root_route() -> list[str]:
    notes: list[str] = []
    doc = load_json(ROOM_ROUTER_FILE, {"declared_total": 0, "routes": []})
    missing, _, routes = analyze_room_router(doc)

    hidden_route = None
    for route in routes:
        if isinstance(route, dict) and route.get("room") == "VYRDOX_HIDDEN_ROOT":
            hidden_route = route
            break

    changed = False
    if hidden_route is None:
        routes.append(
            {
                "route_id": "vyrdox_hidden_root",
                "room": "VYRDOX_HIDDEN_ROOT",
                "route_target": ROOM_ROUTE_TARGET,
            }
        )
        notes.append("added VYRDOX_HIDDEN_ROOT to room_router.json")
        changed = True
    elif hidden_route.get("route_target") != ROOM_ROUTE_TARGET:
        hidden_route["route_target"] = ROOM_ROUTE_TARGET
        notes.append("corrected VYRDOX_HIDDEN_ROOT route target")
        changed = True

    if doc.get("declared_total") != len(routes):
        doc["declared_total"] = len(routes)
        notes.append(f"updated room_router declared_total to {len(routes)}")
        changed = True

    if changed:
        doc["routes"] = routes
        write_json(ROOM_ROUTER_FILE, doc)

    if not notes and "VYRDOX_HIDDEN_ROOT" not in missing:
        notes.append("room_router already includes VYRDOX_HIDDEN_ROOT")

    return notes


def restart_runtime() -> list[str]:
    notes: list[str] = []
    run_shell(["pkill", "-f", OLD_ROOT], check=False)
    notes.append("stopped processes still bound to /home/t79/VXSTATION/kitty")

    for script in [
        BIN_DIR / "mcp-linux-admin-down.sh",
        BIN_DIR / "mcp-time-calendar-down.sh",
        BIN_DIR / "mcp-voice-agent-down.sh",
        BIN_DIR / "agentgateway-down.sh",
    ]:
        run_shell(["bash", str(script)], check=False)

    run_shell(["bash", str(BIN_DIR / "kitty-up.sh")], check=True)
    notes.append("restarted KITTY runtime stack from /home/t79/KITTY/bin")
    return notes


def collect_results() -> tuple[list[CheckResult], dict]:
    results: list[CheckResult] = []

    old_root_processes = find_old_root_processes()
    if old_root_processes:
        results.append(
            CheckResult(
                "old_root_processes",
                "FAIL",
                f"{len(old_root_processes)} process(es) still reference {OLD_ROOT}",
            )
        )
    else:
        results.append(CheckResult("old_root_processes", "PASS", "no stale /home/t79/VXSTATION/kitty processes"))

    room_router_doc = load_json(ROOM_ROUTER_FILE, {"declared_total": 0, "routes": []})
    missing_rooms, extra_rooms, routes = analyze_room_router(room_router_doc)
    if "VYRDOX_HIDDEN_ROOT" in missing_rooms:
        results.append(CheckResult("room_router_hidden_root", "FAIL", "VYRDOX_HIDDEN_ROOT is not routed"))
    else:
        results.append(CheckResult("room_router_hidden_root", "PASS", "VYRDOX_HIDDEN_ROOT is routed"))
    if extra_rooms:
        results.append(
            CheckResult(
                "room_router_extra_rooms",
                "WARN",
                f"extra routed room(s): {', '.join(extra_rooms)}",
            )
        )

    mcp_linux_payload = http_json("http://127.0.0.1:8877/health")
    compose_file = str(mcp_linux_payload.get("compose_file", "")).strip()
    if compose_file == EXPECTED_COMPOSE_FILE:
        results.append(CheckResult("mcp_linux_admin_compose", "PASS", compose_file))
    elif compose_file:
        results.append(CheckResult("mcp_linux_admin_compose", "FAIL", compose_file))
    else:
        results.append(CheckResult("mcp_linux_admin_compose", "FAIL", "health payload missing compose_file"))

    netdata_payload = http_json("http://127.0.0.1:19999/api/v1/info")
    if netdata_payload:
        results.append(CheckResult("netdata", "PASS", "http://127.0.0.1:19999/api/v1/info"))
    else:
        results.append(CheckResult("netdata", "FAIL", "netdata health endpoint unavailable"))

    n8n_payload = http_json("http://127.0.0.1:5678/healthz")
    if n8n_payload:
        results.append(CheckResult("n8n", "PASS", "http://127.0.0.1:5678/healthz"))
    else:
        results.append(CheckResult("n8n", "FAIL", "n8n health endpoint unavailable"))

    feedback_counts = {section: section_file_count(section) for section in FEEDBACK_SECTIONS}
    empty_sections = [name for name, count in feedback_counts.items() if count == 0]
    if empty_sections:
        results.append(
            CheckResult(
                "feedback_content",
                "FAIL",
                f"empty section(s): {', '.join(empty_sections)}",
            )
        )
    else:
        results.append(CheckResult("feedback_content", "PASS", "all feedback sections contain runtime files"))

    frozen_record_count = sum(1 for path in ARCHIVE_FROZEN_DIR.rglob("*") if path.is_file()) if ARCHIVE_FROZEN_DIR.exists() else 0
    if ARCHIVE_BASELINE_FILE.exists() and ARCHIVE_BASELINE_FILE.stat().st_size > 0:
        results.append(CheckResult("archive_baseline", "PASS", str(ARCHIVE_BASELINE_FILE)))
    elif frozen_record_count:
        results.append(
            CheckResult(
                "archive_baseline",
                "FAIL",
                f"missing {ARCHIVE_BASELINE_FILE} with {frozen_record_count} frozen record(s) present",
            )
        )
    else:
        results.append(CheckResult("archive_baseline", "FAIL", "no frozen_records and no baseline file"))

    calendar_payload = http_json("http://127.0.0.1:8792/health")
    state_file = str(calendar_payload.get("state_file", "")).strip()
    if state_file:
        results.append(CheckResult("calendar_dependency", "INFO", state_file))

    station_map_doc = run_json_command(["python3", str(STATION_MAP_FILE), "--pretty"])
    room_colors = {}
    for key in [
        "operation_room",
        "archiving_room",
        "feedback_cloud_vyrdx_room",
        "feedback_room",
        "central_brain",
        "vyrdox_hidden_root",
        "vxstation_control",
    ]:
        node = station_map_doc.get(key)
        if isinstance(node, dict) and "color_state" in node:
            room_colors[key] = node.get("color_state", "unknown")
    if room_colors:
        color_detail = ", ".join(f"{key}={value}" for key, value in sorted(room_colors.items()))
        results.append(CheckResult("station_map", "INFO", color_detail))

    metadata = {
        "old_root_processes": old_root_processes,
        "room_router_routes": routes,
        "feedback_counts": feedback_counts,
        "room_colors": room_colors,
    }
    return results, metadata


def print_results(results: list[CheckResult], metadata: dict) -> int:
    print("VXSTATION SEAL CHECK")
    print(f"generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    print(f"kitty_root: {KITTY_ROOT}")
    print()

    for result in results:
        print(f"[{result.status}] {result.name}: {result.detail}")

    if metadata["old_root_processes"]:
        print()
        print("STALE PROCESSES")
        for process in metadata["old_root_processes"]:
            print(f"  pid={process['pid']} args={process['args']}")

    print()
    print("FEEDBACK SECTION COUNTS")
    for name, count in metadata["feedback_counts"].items():
        print(f"  {name}: {count}")

    fail_count = sum(1 for result in results if result.status == "FAIL")
    warn_count = sum(1 for result in results if result.status == "WARN")
    failing_names = {result.name for result in results if result.status == "FAIL"}
    print()
    print(f"summary: fail={fail_count} warn={warn_count}")

    if fail_count:
        print("seal_status: BLOCKED")
        print()
        print("NEXT ACTIONS")
        if "old_root_processes" in failing_names or "mcp_linux_admin_compose" in failing_names:
            print(f"  /home/t79/KITTY/bin/vxstation-seal.py --restart-runtime")
        if "n8n" in failing_names:
            print("  bring n8n back on 127.0.0.1:5678")
        if "feedback_content" in failing_names:
            print("  put real runtime files into the five FEEDBACK_CLOUD_VYRDX_ROOM sections")
        if "archive_baseline" in failing_names:
            print("  add real ARCHIVING_ROOM/frozen_records content, then create the baseline")
        return 1

    print("seal_status: READY")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Check and repair VXSTATION seal blockers.")
    parser.add_argument(
        "--fix-files",
        action="store_true",
        help="Apply safe file-level fixes without restarting runtime services.",
    )
    parser.add_argument(
        "--restart-runtime",
        action="store_true",
        help="Kill stale old-root processes and restart the KITTY runtime stack.",
    )
    args = parser.parse_args()

    if args.fix_files:
        for note in ensure_hidden_root_route():
            print(f"[FIX] {note}")

    if args.restart_runtime:
        for note in restart_runtime():
            print(f"[FIX] {note}")

    results, metadata = collect_results()
    return print_results(results, metadata)


if __name__ == "__main__":
    sys.exit(main())
