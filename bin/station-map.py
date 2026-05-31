#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import socket
import subprocess
import time
from pathlib import Path
from typing import Any, Optional
from urllib import error, request

KITTY_ROOT = Path("/home/t79/KITTY")
OPS_STATUS_FILE = Path("/home/t79/KITTY/OPERATION_ROOM/monitoring/latest_status.json")
COMMAND_AUDIT_FILE = KITTY_ROOT / "evidence/journal/command_bus.audit.jsonl"
RADAR_SURFACE = KITTY_ROOT / "bin/vxstation_radar.py"
NODES_FILE = KITTY_ROOT / "bridge/nodes.json"
TOPOLOGY_FILE = KITTY_ROOT / "bridge/topology.manifest.json"
CENTRAL_BRAIN_ENGINE_CATALOG_FILE = (
    KITTY_ROOT / "data/szh_central_brain/engine_catalog.json"
)
CENTRAL_BRAIN_INSTALL_MANIFEST_FILE = (
    KITTY_ROOT / "infra/szh_central_brain/install.manifest.json"
)
CENTRAL_BRAIN_MCP_BINDINGS_FILE = (
    KITTY_ROOT / "infra/szh_central_brain/mcp_connector_bindings.json"
)
CENTRAL_BRAIN_NERVOUS_SYSTEM_CATALOG_FILE = (
    KITTY_ROOT / "data/szh_central_brain/mcp_nervous_system.json"
)
CENTRAL_BRAIN_NERVOUS_SYSTEM_MANIFEST_FILE = (
    KITTY_ROOT / "infra/szh_central_brain/nervous_system.manifest.json"
)
CENTRAL_BRAIN_GATEWAY_CATALOG_FILE = (
    KITTY_ROOT / "data/szh_central_brain/gateway_catalog.json"
)
CENTRAL_BRAIN_GATEWAY_MANIFEST_FILE = (
    KITTY_ROOT / "infra/szh_central_brain/gateway_control.manifest.json"
)
CENTRAL_BRAIN_INTEGRATION_ADAPTER_CATALOG_FILE = (
    KITTY_ROOT / "data/szh_central_brain/integration_adapter_catalog.json"
)
CENTRAL_BRAIN_INTEGRATION_ADAPTER_MANIFEST_FILE = (
    KITTY_ROOT / "infra/szh_central_brain/integration_adapter.manifest.json"
)
CENTRAL_BRAIN_LOGIC_ADAPTER_CATALOG_FILE = (
    KITTY_ROOT / "data/szh_central_brain/logic_adapter_catalog.json"
)
CENTRAL_BRAIN_LOGIC_ADAPTER_MANIFEST_FILE = (
    KITTY_ROOT / "infra/szh_central_brain/logic_adapter.manifest.json"
)
CENTRAL_BRAIN_POWER_CONTROL_CATALOG_FILE = (
    KITTY_ROOT / "data/szh_central_brain/power_control_catalog.json"
)
CENTRAL_BRAIN_POWER_CONTROL_MANIFEST_FILE = (
    KITTY_ROOT / "infra/szh_central_brain/power_control.manifest.json"
)
OPERATION_ROOM_RUNTIME_CATALOG_FILE = (
    KITTY_ROOT / "data/operation_room/runtime_catalog.json"
)
OPERATION_ROOM_ENGINE_CATALOG_FILE = (
    KITTY_ROOT / "data/operation_room/engine_catalog.json"
)
OPERATION_ROOM_INSTALL_MANIFEST_FILE = (
    KITTY_ROOT / "infra/operation_room/install.manifest.json"
)
OPERATION_ROOM_MCP_BINDINGS_FILE = (
    KITTY_ROOT / "infra/operation_room/mcp_connector_bindings.json"
)
OPERATION_ROOM_INFRASTRUCTURE_CATALOG_FILE = (
    KITTY_ROOT / "data/operation_room/infrastructure_catalog.json"
)
OPERATION_ROOM_INFRASTRUCTURE_MANIFEST_FILE = (
    KITTY_ROOT / "infra/operation_room/infrastructure.manifest.json"
)
OPERATION_ROOM_BACKBONE_CATALOG_FILE = (
    KITTY_ROOT / "data/operation_room/backbone_catalog.json"
)
OPERATION_ROOM_BACKBONE_MANIFEST_FILE = (
    KITTY_ROOT / "infra/operation_room/backbone_control.manifest.json"
)
VXSTATION_CONTROL_ENGINE_REGISTRY_FILE = (
    KITTY_ROOT / "data/vxstation_control/engine_registry.json"
)
VXSTATION_CONTROL_ADAPTER_REGISTRY_FILE = (
    KITTY_ROOT / "data/vxstation_control/adapter_registry.json"
)
VXSTATION_CONTROL_SERVER_REGISTRY_FILE = (
    KITTY_ROOT / "data/vxstation_control/server_registry.json"
)
VXSTATION_CONTROL_ROOM_ROUTER_FILE = (
    KITTY_ROOT / "data/vxstation_control/room_router.json"
)
VXSTATION_CONTROL_ACTIONS_API_FILE = (
    KITTY_ROOT / "data/vxstation_control/actions_api.json"
)
VXSTATION_CONTROL_COLLECTORS_FILE = (
    KITTY_ROOT / "data/vxstation_control/collectors.json"
)
VXSTATION_CONTROL_CLOUD_TARGET_MANAGER_FILE = (
    KITTY_ROOT / "data/vxstation_control/cloud_target_manager.json"
)
VXSTATION_CONTROL_MANIFEST_FILE = (
    KITTY_ROOT / "infra/vxstation_control/control_plane.manifest.json"
)

LANES = [
    ("lane_01_core", "core", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_01_core"),
    ("lane_02_runtime", "runtime", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_02_runtime"),
    ("lane_03_ops", "ops", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_03_ops"),
    ("lane_04_data", "data", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_04_data"),
    ("lane_05_archive", "archive", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_05_archive"),
    ("lane_06_lab", "lab", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_06_lab"),
    ("lane_07_media", "media", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_07_media"),
    ("lane_08_logs", "logs", "/home/t79/VYRDON/VYRDX/terminal/tower/vyrdon_main/lane_08_logs"),
]

ENGINE_COMMAND_MAP = {
    "aider": "aider",
    "calcure": "calcure",
    "steampipe": "steampipe",
    "tmux": "tmux",
    "btop_plus_plus": "btop",
    "ticker": "ticker",
    "pudb": "pudb3",
}

OPERATION_ROOM_OPTIONAL_ENTRY_IDS = {
    "openhands",
    "vllm",
}

CENTRAL_BRAIN_OPTIONAL_ENGINE_IDS = {
    "plasma_hd_clock",
}

OPTIONAL_SERVICE_KEYS = {
    "vllm",
}

OPERATION_ROOM_OPTIONAL_ENGINE_IDS = {
    "zsh_auto_suggestions",
    "taskwarrior",
    "hummingbot",
    "accio_quantum_core",
    "agentsh",
    "ticker",
    "pdsh",
    "pudb",
}


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return fallback


def http_json(url: str, timeout: float = 2.0) -> dict[str, Any]:
    req = request.Request(url, method="GET")
    try:
        with request.urlopen(req, timeout=timeout) as res:
            body = res.read().decode("utf-8")
            return json.loads(body) if body else {}
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {}


def http_text(url: str, timeout: float = 2.0) -> str:
    req = request.Request(url, method="GET")
    try:
        with request.urlopen(req, timeout=timeout) as res:
            return res.read().decode("utf-8")
    except (error.URLError, error.HTTPError, TimeoutError, UnicodeDecodeError):
        return ""


def http_probe(url: str, timeout: float = 4.0) -> dict[str, Any]:
    req = request.Request(
        url,
        method="GET",
        headers={"User-Agent": "KITTY-VXSTATION/1.0"},
    )
    try:
        with request.urlopen(req, timeout=timeout) as res:
            body = res.read().decode("utf-8", errors="replace")
            content_type = str(res.headers.get("content-type", "")).strip()
            payload: dict[str, Any] | None = None
            if "json" in content_type.lower():
                try:
                    decoded = json.loads(body) if body else {}
                    if isinstance(decoded, dict):
                        payload = decoded
                except json.JSONDecodeError:
                    payload = None
            return {
                "ok": 200 <= int(res.status) < 400,
                "status": int(res.status),
                "content_type": content_type,
                "json": payload,
                "text": body[:400],
            }
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {
            "ok": False,
            "status": int(exc.code),
            "error": f"http_{exc.code}",
            "text": body[:400],
        }
    except error.URLError as exc:
        reason = getattr(exc, "reason", exc)
        return {
            "ok": False,
            "status": None,
            "error": str(reason),
        }
    except TimeoutError:
        return {
            "ok": False,
            "status": None,
            "error": "timeout",
        }


def command_exists(command: str) -> bool:
    local_paths = [
        str(Path.home() / ".local" / "bin"),
        str(Path.home() / ".local" / "npm" / "bin"),
    ]
    joined_path = os.pathsep.join(local_paths + [os.environ.get("PATH", "")])
    return shutil.which(command, path=joined_path) is not None


def health_is_ok(payload: dict[str, Any], expected_service_name: Optional[str] = None) -> bool:
    if not payload:
        return False

    ok_value = payload.get("ok")
    status_value = str(payload.get("status", "")).strip().lower()
    service_value = str(payload.get("service", "")).strip()

    status_ok = bool(ok_value) or status_value in {"ok", "healthy", "ready", "running"}
    if not status_ok:
        return False

    if expected_service_name and service_value and service_value != expected_service_name:
        return False

    return True


def to_color(ok: bool) -> str:
    return "green" if ok else "red"


def cloud_probe_detail(target: dict[str, Any], probe: dict[str, Any]) -> str:
    payload = probe.get("json")
    if isinstance(payload, dict):
        commit = str(payload.get("commit", "")).strip()
        release_id = str(payload.get("releaseId", "")).strip()
        built_at = str(payload.get("builtAt", "")).strip()
        service = str(payload.get("service", "")).strip()
        status = str(payload.get("status", "")).strip()
        if release_id or commit:
            parts = []
            if release_id:
                parts.append(release_id)
            if commit:
                parts.append(commit[:7])
            if built_at:
                parts.append(built_at)
            return " ".join(parts)
        if service or status:
            return " ".join(part for part in [service, status] if part).strip()

    if probe.get("status") is not None:
        return f"http_{probe['status']}"

    profile = str(target.get("profile", "")).strip()
    error_reason = str(probe.get("error", "")).strip()
    if error_reason:
        return error_reason
    if profile:
        return profile
    return "probe_failed"


def catalog_health(doc: dict[str, Any], key: str) -> dict[str, Any]:
    items = doc.get(key, [])
    if not isinstance(items, list):
        items = []
    declared_total = int(doc.get("declared_total", len(items)) or len(items))
    catalogued_total = len(items)
    gap_total = max(declared_total - catalogued_total, 0)
    is_green = gap_total == 0 and catalogued_total > 0
    return {
        "declared_total": declared_total,
        "catalogued_total": catalogued_total,
        "gap_total": gap_total,
        "color_state": to_color(is_green),
    }


def count_tag(items: list[dict[str, Any]], tag: str) -> int:
    return len(
        [
            item
            for item in items
            if tag in [str(value).strip() for value in item.get("tags", []) if str(value).strip()]
        ]
    )


def port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def central_brain_engine_is_green(engine: dict[str, Any]) -> bool:
    engine_id = str(engine.get("engine_id", "")).strip()
    observed = str(engine.get("observed_state", "")).strip().lower()
    if engine_id in CENTRAL_BRAIN_OPTIONAL_ENGINE_IDS and observed == "missing":
        return True
    return observed in {
        "installed",
        "configured",
        "running",
        "active",
        "ready",
        "installed_and_configured",
    }


def operation_room_engine_is_green(engine: dict[str, Any]) -> bool:
    observed = str(engine.get("observed_state", "")).strip().lower()
    if observed in {
        "installed",
        "configured",
        "running",
        "active",
        "ready",
        "installed_and_configured",
    }:
        return True

    engine_id = str(engine.get("engine_id", "")).strip()
    command = ENGINE_COMMAND_MAP.get(engine_id)
    if command:
        return command_exists(command)
    return False


def nervous_system_snapshot(bridge_nodes: list[dict[str, Any]]) -> dict[str, Any]:
    doc = read_json(CENTRAL_BRAIN_NERVOUS_SYSTEM_CATALOG_FILE, {})
    manifest = read_json(CENTRAL_BRAIN_NERVOUS_SYSTEM_MANIFEST_FILE, {})
    required_minimum = int(manifest.get("required_bridge_nodes_minimum", 0) or 0)
    required_connectors = manifest.get("required_connectors") or doc.get("connectors", [])
    healthy_nodes = [
        node
        for node in bridge_nodes
        if str(node.get("status", "")).strip() == "online" and bool(node.get("health_ok"))
    ]
    healthy_total = len(healthy_nodes)
    declared_total = len(bridge_nodes)
    connector_rows: list[dict[str, Any]] = []

    for connector in required_connectors:
        connector_id = str(connector.get("connector_id", "")).strip()
        node_id = str(connector.get("node_id", "")).strip()
        expected_service_name = str(connector.get("expected_service_name", "")).strip() or None
        required_capabilities = [
            str(capability).strip()
            for capability in connector.get("required_capabilities", [])
            if str(capability).strip()
        ]
        node = next(
            (
                candidate
                for candidate in bridge_nodes
                if (
                    node_id
                    and str(candidate.get("node_id", "")).strip() == node_id
                )
                or (
                    connector_id
                    and str(candidate.get("connector_id", "")).strip() == connector_id
                )
            ),
            None,
        )
        node_capabilities = {
            str(capability).strip()
            for capability in (node or {}).get("capabilities", [])
            if str(capability).strip()
        }
        missing_capabilities = sorted(set(required_capabilities) - node_capabilities)
        service_name = str((node or {}).get("service_name", "")).strip()
        status = str((node or {}).get("status", "")).strip() or "missing"
        connector_green = bool(node) and status == "online"
        connector_green = connector_green and not missing_capabilities
        connector_green = connector_green and health_is_ok(
            (node or {}).get("health") or {}, expected_service_name
        )

        if not node:
            detail = "missing_node"
        elif missing_capabilities:
            detail = f"missing_capabilities:{','.join(missing_capabilities)}"
        elif service_name:
            detail = service_name
        else:
            detail = status

        connector_rows.append(
            {
                "connector_id": connector_id or None,
                "node_id": node_id or None,
                "name": connector.get("name"),
                "role": connector.get("role"),
                "install_inside": connector.get("install_inside"),
                "transport": connector.get("transport") or (node or {}).get("transport"),
                "endpoint": connector.get("endpoint") or (node or {}).get("endpoint"),
                "required_capability_total": len(required_capabilities),
                "missing_capabilities": missing_capabilities,
                "expected_service_name": expected_service_name,
                "observed_service_name": service_name or None,
                "observed_status": status,
                "color_state": to_color(connector_green),
                "detail": detail,
            }
        )

    connector_green_total = len(
        [connector for connector in connector_rows if connector.get("color_state") == "green"]
    )
    connectors_green = len(connector_rows) > 0 and connector_green_total == len(connector_rows)
    connectivity_green = healthy_total >= required_minimum and connectors_green
    return {
        "desired_state": doc.get("desired_state", "unknown"),
        "observed_state": manifest.get("observed_state", doc.get("observed_state", "unknown")),
        "role": doc.get("role", "unknown"),
        "transport": doc.get("transport", manifest.get("transport", "unknown")),
        "route_target": doc.get("route_target", manifest.get("route_target", "unknown")),
        "required_bridge_nodes_minimum": required_minimum,
        "legacy_active_stack_lanes": int(manifest.get("legacy_active_stack_lanes", 0) or 0),
        "legacy_reserved_nervous_system_slots": int(
            manifest.get("legacy_reserved_nervous_system_slots", 0) or 0
        ),
        "required_connector_total": len(connector_rows),
        "connector_green_total": connector_green_total,
        "connector_red_total": len(connector_rows) - connector_green_total,
        "declared_bridge_nodes": declared_total,
        "healthy_bridge_nodes": healthy_total,
        "connectors": connector_rows,
        "color_state": to_color(connectivity_green),
    }


def gateway_snapshot() -> dict[str, Any]:
    doc = read_json(CENTRAL_BRAIN_GATEWAY_CATALOG_FILE, {})
    manifest = read_json(CENTRAL_BRAIN_GATEWAY_MANIFEST_FILE, {})
    gateways = doc.get("gateways", [])
    gateway = gateways[0] if gateways else {}
    runtime = manifest.get("runtime", gateway.get("runtime", {})) or {}
    bind_host = str(runtime.get("bind_host", "127.0.0.1")).strip() or "127.0.0.1"
    bind_port = int(runtime.get("bind_port", 0) or 0)
    endpoint = f"http://{bind_host}:{bind_port}" if bind_port > 0 else ""
    health = http_json(f"{endpoint}/health") if endpoint else {}
    health_ok = health_is_ok(health, "vxstation-agentgateway")
    bind_up = port_open(bind_host, bind_port) if bind_port > 0 else False
    return {
        "gateway_id": manifest.get("gateway_id", gateway.get("gateway_id")),
        "name": gateway.get("name"),
        "provider": gateway.get("provider"),
        "role": gateway.get("role"),
        "desired_state": gateway.get("desired_state", manifest.get("desired_state", "unknown")),
        "observed_state": manifest.get("observed_state", gateway.get("observed_state", "unknown")),
        "install_inside": gateway.get("install_inside"),
        "install_manifest": gateway.get("install_manifest"),
        "route_target": manifest.get("route_target", gateway.get("route_target")),
        "security_mode": manifest.get("security_mode", gateway.get("security_mode")),
        "bind": f"{bind_host}:{bind_port}" if bind_port > 0 else None,
        "bind_state": "listening" if bind_up else "down",
        "endpoint": endpoint or None,
        "health_ok": health_ok,
        "health": health or None,
        "loopback_only": bool(runtime.get("loopback_only", False)),
        "public_exposure": runtime.get("public_exposure"),
        "bearer_token_required": bool(runtime.get("bearer_token_required", False)),
        "caller_header_required": bool(runtime.get("caller_header_required", False)),
        "color_state": to_color(health_ok),
    }


def integration_adapter_snapshot() -> dict[str, Any]:
    doc = read_json(CENTRAL_BRAIN_INTEGRATION_ADAPTER_CATALOG_FILE, {})
    manifest = read_json(CENTRAL_BRAIN_INTEGRATION_ADAPTER_MANIFEST_FILE, {})
    adapters = doc.get("adapters", [])
    declared_total = int(manifest.get("declared_total", doc.get("declared_total", 0)) or 0)
    catalogued_total = len(adapters)
    gap_total = max(declared_total - catalogued_total, 0)
    return {
        "desired_state": doc.get("desired_state", manifest.get("desired_state", "unknown")),
        "observed_state": manifest.get("observed_state", doc.get("observed_state", "unknown")),
        "declared_total": declared_total,
        "catalogued_total": catalogued_total,
        "gap_total": gap_total,
        "cloud_connector_total": count_tag(adapters, "cloud"),
        "business_connector_total": count_tag(adapters, "business"),
        "engineering_connector_total": count_tag(adapters, "engineering"),
        "hardware_acceleration_total": count_tag(adapters, "hardware_acceleration"),
        "thermal_control_total": count_tag(adapters, "thermal_control"),
        "inventory_state": "catalog_complete" if gap_total == 0 else "catalog_gap",
        "color_state": to_color(gap_total == 0),
    }


def logic_adapter_snapshot() -> dict[str, Any]:
    doc = read_json(CENTRAL_BRAIN_LOGIC_ADAPTER_CATALOG_FILE, {})
    manifest = read_json(CENTRAL_BRAIN_LOGIC_ADAPTER_MANIFEST_FILE, {})
    adapters = doc.get("adapters", [])
    declared_total = int(manifest.get("declared_total", doc.get("declared_total", 0)) or 0)
    gap_total = max(declared_total - len(adapters), 0)
    return {
        "desired_state": doc.get("desired_state", manifest.get("desired_state", "unknown")),
        "observed_state": manifest.get("observed_state", doc.get("observed_state", "unknown")),
        "declared_total": declared_total,
        "catalogued_total": len(adapters),
        "gap_total": gap_total,
        "mcp_total": count_tag(adapters, "mcp"),
        "asset_mapping_total": count_tag(adapters, "asset_mapping"),
        "infrastructure_control_total": count_tag(adapters, "infrastructure_control"),
        "room_isolation_total": count_tag(adapters, "room_isolation"),
        "inventory_state": "catalog_complete" if gap_total == 0 else "catalog_gap",
        "color_state": to_color(gap_total == 0),
    }


def power_control_snapshot(
    gateway: dict[str, Any], nervous_system: dict[str, Any]
) -> dict[str, Any]:
    doc = read_json(CENTRAL_BRAIN_POWER_CONTROL_CATALOG_FILE, {})
    manifest = read_json(CENTRAL_BRAIN_POWER_CONTROL_MANIFEST_FILE, {})
    operation_manifest_path = Path(
        str(
            manifest.get("operation_room_manifest")
            or doc.get("operation_room_manifest")
            or OPERATION_ROOM_INFRASTRUCTURE_MANIFEST_FILE
        )
    )
    backbone_manifest_path = Path(
        str(
            manifest.get("backbone_manifest")
            or doc.get("backbone_manifest")
            or OPERATION_ROOM_BACKBONE_MANIFEST_FILE
        )
    )
    operation_manifest = read_json(operation_manifest_path, {})
    backbone_manifest = read_json(backbone_manifest_path, {})
    required_connector_id = str(manifest.get("required_connector_id", "")).strip() or None
    required_node_id = str(manifest.get("required_node_id", "")).strip() or None
    connector_row = next(
        (
            connector
            for connector in nervous_system.get("connectors", [])
            if (
                required_connector_id
                and str(connector.get("connector_id", "")).strip() == required_connector_id
            )
            or (
                required_node_id
                and str(connector.get("node_id", "")).strip() == required_node_id
            )
        ),
        None,
    )
    operation_room_wired = (
        str(operation_manifest.get("route_target", "")).strip()
        == str(manifest.get("route_target", "")).strip()
    )
    backbone_wired = (
        str(backbone_manifest.get("route_target", "")).strip()
        == str(manifest.get("route_target", "")).strip()
    )
    gateway_wired = (
        str(gateway.get("gateway_id", "")).strip() == str(manifest.get("gateway_id", "")).strip()
        and str(gateway.get("route_target", "")).strip()
        == str(manifest.get("route_target", "")).strip()
    )
    nervous_system_wired = bool(connector_row) and connector_row.get("color_state") == "green"
    remote_power_surfaces = manifest.get(
        "required_remote_power_surfaces", doc.get("power_surfaces", [])
    )
    scheduled_maintenance_surfaces = manifest.get(
        "required_scheduled_maintenance_surfaces", doc.get("scheduled_maintenance_surfaces", [])
    )
    central_power_green = (
        operation_room_wired
        and backbone_wired
        and gateway_wired
        and gateway.get("color_state") == "green"
        and nervous_system_wired
    )
    return {
        "desired_state": doc.get("desired_state", manifest.get("desired_state", "unknown")),
        "observed_state": manifest.get("observed_state", doc.get("observed_state", "unknown")),
        "gateway_id": manifest.get("gateway_id"),
        "route_target": manifest.get("route_target"),
        "primary_power_surface": manifest.get("primary_power_surface"),
        "server_total": int(manifest.get("server_total", 0) or 0),
        "management_oob_network": manifest.get("management_oob_network"),
        "required_remote_power_surface_total": len(remote_power_surfaces),
        "required_scheduled_maintenance_surface_total": len(scheduled_maintenance_surfaces),
        "required_connector_id": required_connector_id,
        "connector_color_state": (connector_row or {}).get("color_state", "red"),
        "connector_detail": (connector_row or {}).get("detail"),
        "operation_room_wired": operation_room_wired,
        "backbone_wired": backbone_wired,
        "gateway_wired": gateway_wired,
        "nervous_system_wired": nervous_system_wired,
        "color_state": to_color(central_power_green),
    }


def operation_room_infrastructure_snapshot() -> dict[str, Any]:
    doc = read_json(OPERATION_ROOM_INFRASTRUCTURE_CATALOG_FILE, {})
    manifest = read_json(OPERATION_ROOM_INFRASTRUCTURE_MANIFEST_FILE, {})
    sections = doc.get("sections", {})
    storage_items = (sections.get("storage_adapters") or {}).get("items", [])
    power_items = (sections.get("power_management") or {}).get("items", [])
    storage_declared_total = int(
        manifest.get(
            "storage_adapters_declared_total",
            (sections.get("storage_adapters") or {}).get("declared_total", 0),
        )
        or 0
    )
    power_declared_total = int(
        manifest.get(
            "power_management_declared_total",
            (sections.get("power_management") or {}).get("declared_total", 0),
        )
        or 0
    )
    storage_gap_total = max(storage_declared_total - len(storage_items), 0)
    power_gap_total = max(power_declared_total - len(power_items), 0)
    return {
        "desired_state": doc.get("desired_state", manifest.get("desired_state", "unknown")),
        "observed_state": manifest.get("observed_state", doc.get("observed_state", "unknown")),
        "storage_adapters": {
            "declared_total": storage_declared_total,
            "catalogued_total": len(storage_items),
            "gap_total": storage_gap_total,
            "nvme_total": count_tag(storage_items, "nvme"),
            "sas_total": count_tag(storage_items, "sas"),
            "sata_total": count_tag(storage_items, "sata"),
            "form_factor_total": count_tag(storage_items, "form_factor"),
            "controller_total": count_tag(storage_items, "controller"),
            "inventory_state": "catalog_complete" if storage_gap_total == 0 else "catalog_gap",
        },
        "power_management": {
            "declared_total": power_declared_total,
            "catalogued_total": len(power_items),
            "gap_total": power_gap_total,
            "remote_power_control_total": count_tag(power_items, "remote_power_control"),
            "centralized_power_management_total": count_tag(
                power_items, "centralized_power_management"
            ),
            "scheduled_maintenance_total": count_tag(power_items, "scheduled_maintenance"),
            "resilience_total": count_tag(power_items, "resilience"),
            "console_interface_total": count_tag(power_items, "console_interface"),
            "power_path_total": count_tag(power_items, "power_path"),
            "inventory_state": "catalog_complete" if power_gap_total == 0 else "catalog_gap",
        },
    }


def operation_room_backbone_snapshot() -> dict[str, Any]:
    doc = read_json(OPERATION_ROOM_BACKBONE_CATALOG_FILE, {})
    manifest = read_json(OPERATION_ROOM_BACKBONE_MANIFEST_FILE, {})
    items = (doc.get("physical_backbone") or {}).get("items", [])
    room_wiring = doc.get("room_wiring", [])
    declared_total = int(
        manifest.get("physical_backbone_declared_total", (doc.get("physical_backbone") or {}).get("declared_total", 0))
        or 0
    )
    gap_total = max(declared_total - len(items), 0)
    return {
        "desired_state": doc.get("desired_state", manifest.get("desired_state", "unknown")),
        "observed_state": manifest.get("observed_state", doc.get("observed_state", "unknown")),
        "server_total": int(manifest.get("server_total", 0) or 0),
        "physical_backbone_declared_total": declared_total,
        "physical_backbone_catalogued_total": len(items),
        "physical_backbone_gap_total": gap_total,
        "data_fabric_total": count_tag(items, "data_fabric"),
        "oob_management_total": count_tag(items, "oob_management"),
        "power_recovery_total": count_tag(items, "power_recovery"),
        "room_wiring_total": len(room_wiring),
        "inventory_state": "catalog_complete" if gap_total == 0 else "catalog_gap",
        "color_state": to_color(gap_total == 0),
    }


def docker_state(container_name: str) -> str:
    try:
        proc = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Status}}", container_name],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            return "not_found"
        return (proc.stdout or "").strip() or "unknown"
    except Exception:
        return "unknown"


def count_gate() -> dict[str, int]:
    accepted = 0
    denied = 0
    if not COMMAND_AUDIT_FILE.exists():
        return {"accepted": 0, "denied": 0}

    for raw in COMMAND_AUDIT_FILE.read_text("utf-8").splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
            receipt = parsed.get("receipt", {})
            if bool(receipt.get("accepted")):
                accepted += 1
            else:
                denied += 1
        except Exception:
            denied += 1
    return {"accepted": accepted, "denied": denied}


def lane_snapshot() -> list[dict[str, Any]]:
    snapshot: list[dict[str, Any]] = []
    for lane_id, label, root in LANES:
        snapshot.append(
            {
                "id": lane_id,
                "label": label,
                "root": root,
                "online": Path(root).exists(),
            }
        )
    return snapshot


def module_snapshot() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    modules_root = KITTY_ROOT / "modules"
    if not modules_root.exists():
        return out

    for child in sorted(modules_root.iterdir()):
        if not child.is_dir():
            continue
        manifest = child / "module.manifest.json"
        if manifest.exists():
            doc = read_json(manifest, {})
            out.append(
                {
                    "name": str(doc.get("name", child.name)),
                    "version": str(doc.get("version", "unknown")),
                }
            )
        else:
            out.append({"name": child.name, "version": "unknown"})
    return out


def bridge_snapshot() -> list[dict[str, Any]]:
    nodes_doc = read_json(NODES_FILE, {"nodes": []})
    nodes = nodes_doc.get("nodes", [])
    out: list[dict[str, Any]] = []
    for node in nodes:
        endpoint = str(node.get("endpoint", "")).rstrip("/")
        connector = node.get("connector", {}) or {}
        topology = node.get("topology", {}) or {}
        health = http_json(f"{endpoint}/health") if endpoint else {}
        service_name = str((health or {}).get("service", "")).strip() or None
        out.append(
            {
                "node_id": node.get("node_id"),
                "endpoint": endpoint,
                "status": node.get("status"),
                "trust_level": node.get("trust_level"),
                "connector_id": connector.get("connector_id"),
                "transport": connector.get("transport"),
                "topology_role": topology.get("role"),
                "capabilities": node.get("capabilities", []),
                "health_ok": health_is_ok(health),
                "color_state": to_color(health_is_ok(health)),
                "service_name": service_name,
                "health": health or None,
            }
        )
    return out


def topology_snapshot(bridge_nodes: list[dict[str, Any]]) -> dict[str, Any]:
    doc = read_json(TOPOLOGY_FILE, {})
    transport = doc.get("transport_policy", {})
    capacity = doc.get("capacity_policy", {})
    total_slots = int(capacity.get("total_engine_and_server_slots", 0) or 0)
    registered_nodes = len(bridge_nodes)
    remaining_capacity = max(total_slots - registered_nodes, 0) if total_slots else None
    return {
        "routing_mode": doc.get("routing_mode", "unknown"),
        "mcp_connectors_required": bool(transport.get("mcp_connectors_required")),
        "single_gateway_path_required": bool(transport.get("single_gateway_path_required")),
        "tunnel_required_for_remote": bool(transport.get("tunnel_required_for_remote")),
        "total_engine_and_server_slots": total_slots,
        "legacy_active_stack_lanes": int(capacity.get("legacy_active_stack_lanes", 0) or 0),
        "legacy_reserved_nervous_system_slots": int(
            capacity.get("legacy_reserved_nervous_system_slots", 0) or 0
        ),
        "registered_bridge_nodes": registered_nodes,
        "remaining_bridge_capacity": remaining_capacity,
    }


def central_brain_snapshot(bridge_nodes: list[dict[str, Any]]) -> dict[str, Any]:
    doc = read_json(CENTRAL_BRAIN_ENGINE_CATALOG_FILE, {})
    install_doc = read_json(CENTRAL_BRAIN_INSTALL_MANIFEST_FILE, {})
    binding_doc = read_json(CENTRAL_BRAIN_MCP_BINDINGS_FILE, {})
    nervous_system = nervous_system_snapshot(bridge_nodes)
    gateway = gateway_snapshot()
    integration_adapters = integration_adapter_snapshot()
    logic_adapters = logic_adapter_snapshot()
    power_control = power_control_snapshot(gateway, nervous_system)
    engines = doc.get("engines", [])
    pending = [
        engine
        for engine in engines
        if "install" in engine and "seeded" in str(engine.get("observed_state", ""))
    ]
    engine_rows = [
        {
            "engine_id": engine.get("engine_id"),
            "name": engine.get("name"),
            "class": engine.get("class"),
            "observed_state": engine.get("observed_state"),
            "color_state": to_color(central_brain_engine_is_green(engine)),
            "install_inside": (engine.get("install") or {}).get("install_inside"),
            "install_manifest": (engine.get("install") or {}).get("manifest"),
            "connector_id": (engine.get("integration") or {}).get("connector_id"),
            "transport": (engine.get("integration") or {}).get("transport"),
        }
        for engine in engines
    ]
    green_total = len([engine for engine in engine_rows if engine["color_state"] == "green"])
    red_total = len(engine_rows) - green_total
    engines_green = red_total == 0 and len(engine_rows) > 0
    central_brain_green = (
        engines_green
        and nervous_system.get("color_state") == "green"
        and gateway.get("color_state") == "green"
        and power_control.get("color_state") == "green"
    )
    return {
        "desired_state": doc.get("desired_state", "unknown"),
        "observed_state": doc.get("observed_state", "unknown"),
        "install_root": install_doc.get("install_root"),
        "install_manifest_state": install_doc.get("observed_state", "unknown"),
        "mcp_binding_state": binding_doc.get("observed_state", "unknown"),
        "gateway": gateway,
        "integration_adapters": integration_adapters,
        "logic_adapters": logic_adapters,
        "power_control": power_control,
        "nervous_system": nervous_system,
        "engine_total": len(engines),
        "pending_install_total": len(pending),
        "green_total": green_total,
        "red_total": red_total,
        "color_state": to_color(central_brain_green),
        "engines": engine_rows,
    }


def operation_room_snapshot(services: dict[str, Any]) -> dict[str, Any]:
    runtime_doc = read_json(OPERATION_ROOM_RUNTIME_CATALOG_FILE, {})
    engine_doc = read_json(OPERATION_ROOM_ENGINE_CATALOG_FILE, {})
    install_doc = read_json(OPERATION_ROOM_INSTALL_MANIFEST_FILE, {})
    binding_doc = read_json(OPERATION_ROOM_MCP_BINDINGS_FILE, {})
    infrastructure = operation_room_infrastructure_snapshot()
    backbone = operation_room_backbone_snapshot()
    entries = runtime_doc.get("entries", [])
    engines = engine_doc.get("engines", [])
    rows: list[dict[str, Any]] = []

    for entry in entries:
        source = entry.get("source", {}) or {}
        source_type = str(source.get("type", "")).strip()
        service_key = str(source.get("service_key", "")).strip()
        expected_service_name = str(source.get("expected_service_name", "")).strip() or None
        entry_id = str(entry.get("entry_id", "")).strip()
        expected_container_state = (
            str(source.get("expected_container_state", "")).strip() or "running"
        )
        service_row = services.get(service_key, {})
        color_state = "red"
        detail = "missing"
        critical = entry_id not in OPERATION_ROOM_OPTIONAL_ENTRY_IDS

        if source_type == "container":
            state = str(service_row.get("state", "unknown")).strip()
            ok = state == expected_container_state
            color_state = to_color(ok)
            detail = state
        elif source_type == "health":
            health = service_row.get("health") or {}
            ok = health_is_ok(health, expected_service_name)
            color_state = to_color(ok)
            detail = (
                str(health.get("service", "")).strip()
                or str(health.get("status", "")).strip()
                or "unhealthy"
            )
        elif source_type == "service":
            ok = bool(service_row.get("health_ok"))
            color_state = to_color(ok)
            detail = "ok" if ok else "down"
        elif source_type == "command":
            expected_command = str(source.get("expected_command", "")).strip()
            ok = bool(service_row.get("present"))
            color_state = to_color(ok)
            detail = expected_command if ok else f"missing:{expected_command or service_key}"

        rows.append(
            {
                "entry_id": entry.get("entry_id"),
                "name": entry.get("name"),
                "kind": entry.get("kind"),
                "critical": critical,
                "color_state": color_state,
                "detail": detail,
            }
        )

    engine_rows = [
        {
            "engine_id": engine.get("engine_id"),
            "name": engine.get("name"),
            "class": engine.get("class"),
            "observed_state": engine.get("observed_state"),
            "critical": str(engine.get("engine_id", "")).strip()
            not in OPERATION_ROOM_OPTIONAL_ENGINE_IDS,
            "color_state": to_color(operation_room_engine_is_green(engine)),
            "agent_suite": engine.get("agent_suite", []),
            "install_inside": (engine.get("install") or {}).get("install_inside"),
            "install_manifest": (engine.get("install") or {}).get("manifest"),
            "connector_id": (engine.get("integration") or {}).get("connector_id"),
            "transport": (engine.get("integration") or {}).get("transport"),
        }
        for engine in engines
    ]

    green_total = len([entry for entry in rows if entry["color_state"] == "green"]) + len(
        [engine for engine in engine_rows if engine["color_state"] == "green"]
    )
    red_total = (len(rows) + len(engine_rows)) - green_total
    critical_rows = [entry for entry in rows if bool(entry.get("critical", True))]
    critical_engines = [engine for engine in engine_rows if bool(engine.get("critical", True))]
    critical_green_total = len(
        [entry for entry in critical_rows if entry["color_state"] == "green"]
    ) + len([engine for engine in critical_engines if engine["color_state"] == "green"])
    critical_red_total = (len(critical_rows) + len(critical_engines)) - critical_green_total
    return {
        "desired_state": runtime_doc.get("desired_state", "unknown"),
        "observed_state": runtime_doc.get("observed_state", "unknown"),
        "install_manifest_state": install_doc.get("observed_state", "unknown"),
        "mcp_binding_state": binding_doc.get("observed_state", "unknown"),
        "infrastructure": infrastructure,
        "backbone": backbone,
        "runtime_entry_total": len(rows),
        "engine_total": len(engine_rows),
        "green_total": green_total,
        "red_total": red_total,
        "critical_entry_total": len(critical_rows),
        "critical_engine_total": len(critical_engines),
        "critical_green_total": critical_green_total,
        "critical_red_total": critical_red_total,
        "color_state": to_color(
            critical_red_total == 0 and (len(critical_rows) + len(critical_engines)) > 0
        ),
        "entries": rows,
        "engines": engine_rows,
    }


def vxstation_control_snapshot(services: dict[str, Any]) -> dict[str, Any]:
    manifest_doc = read_json(VXSTATION_CONTROL_MANIFEST_FILE, {})
    engine_doc = read_json(VXSTATION_CONTROL_ENGINE_REGISTRY_FILE, {})
    adapter_doc = read_json(VXSTATION_CONTROL_ADAPTER_REGISTRY_FILE, {})
    server_doc = read_json(VXSTATION_CONTROL_SERVER_REGISTRY_FILE, {})
    room_router_doc = read_json(VXSTATION_CONTROL_ROOM_ROUTER_FILE, {})
    actions_doc = read_json(VXSTATION_CONTROL_ACTIONS_API_FILE, {})
    collectors_doc = read_json(VXSTATION_CONTROL_COLLECTORS_FILE, {})
    cloud_doc = read_json(VXSTATION_CONTROL_CLOUD_TARGET_MANAGER_FILE, {})

    engines = engine_doc.get("engines", [])
    if not isinstance(engines, list):
        engines = []
    adapters = adapter_doc.get("adapters", [])
    if not isinstance(adapters, list):
        adapters = []
    server_specs = server_doc.get("servers", [])
    if not isinstance(server_specs, list):
        server_specs = []
    route_specs = room_router_doc.get("routes", [])
    if not isinstance(route_specs, list):
        route_specs = []
    action_specs = actions_doc.get("actions", [])
    if not isinstance(action_specs, list):
        action_specs = []
    collector_specs = collectors_doc.get("collectors", [])
    if not isinstance(collector_specs, list):
        collector_specs = []
    cloud_targets = cloud_doc.get("targets", [])
    if not isinstance(cloud_targets, list):
        cloud_targets = []

    engine_registry = catalog_health(engine_doc, "engines")
    engine_registry["control_enabled_total"] = len(
        [engine for engine in engines if bool(engine.get("control_enabled"))]
    )

    adapter_registry = catalog_health(adapter_doc, "adapters")

    server_rows: list[dict[str, Any]] = []
    for server in server_specs:
        service_key = str(server.get("service_key", "")).strip()
        check_type = str(server.get("check_type", "service")).strip()
        expected_service_name = str(server.get("expected_service_name", "")).strip() or None
        service_row = services.get(service_key, {}) if service_key else {}
        ok = False
        detail = "missing"

        if check_type == "health":
            health = service_row.get("health") or {}
            ok = bool(service_row.get("health_ok")) and health_is_ok(health, expected_service_name)
            detail = (
                str(health.get("service", "")).strip()
                or str(health.get("status", "")).strip()
                or ("ok" if ok else "unhealthy")
            )
        elif check_type == "service":
            ok = bool(service_row.get("health_ok"))
            detail = "ok" if ok else "down"
        elif check_type == "container":
            state = str(service_row.get("state", "missing")).strip()
            ok = state == "running"
            detail = state
        elif check_type == "command":
            command_name = str(service_row.get("command", "")).strip()
            ok = bool(service_row.get("present"))
            detail = command_name if ok else f"missing:{command_name}"

        server_rows.append(
            {
                "server_id": server.get("server_id"),
                "name": server.get("name"),
                "service_key": service_key,
                "check_type": check_type,
                "critical": bool(server.get("critical", True)),
                "color_state": to_color(ok),
                "detail": detail,
            }
        )

    server_green_total = len([row for row in server_rows if row.get("color_state") == "green"])
    server_registry = catalog_health(server_doc, "servers")
    server_registry.update(
        {
            "green_total": server_green_total,
            "red_total": len(server_rows) - server_green_total,
            "servers": server_rows,
            "color_state": to_color(
                server_registry["gap_total"] == 0
                and len(server_rows) > 0
                and server_green_total == len(server_rows)
            ),
        }
    )

    room_router = catalog_health(room_router_doc, "routes")
    route_target = str(manifest_doc.get("route_target", "vxstation.bridge.dispatch")).strip()
    route_target_mismatch_total = len(
        [
            route
            for route in route_specs
            if str(route.get("route_target", "")).strip() != route_target
        ]
    )
    room_router.update(
        {
            "route_target": route_target,
            "route_target_mismatch_total": route_target_mismatch_total,
            "color_state": to_color(
                room_router["gap_total"] == 0
                and len(route_specs) > 0
                and route_target_mismatch_total == 0
            ),
        }
    )

    actions_api = catalog_health(actions_doc, "actions")
    actions_base = str(actions_doc.get("base_endpoint", "")).strip()
    actions_health_ok = health_is_ok(http_json("http://127.0.0.1:46080/health"), "vxstation-agentgateway")
    actions_api.update(
        {
            "base_endpoint": actions_base,
            "gateway_health_ok": actions_health_ok,
            "color_state": to_color(
                actions_api["gap_total"] == 0 and len(action_specs) > 0 and actions_health_ok
            ),
        }
    )

    collector_rows: list[dict[str, Any]] = []
    for collector in collector_specs:
        collector_type = str(collector.get("type", "")).strip()
        ok = False
        detail = "unknown"
        if collector_type == "file":
            source = str(collector.get("source", "")).strip()
            ok = bool(source) and Path(source).exists()
            detail = "present" if ok else "missing"
        elif collector_type == "service":
            service_key = str(collector.get("service_key", "")).strip()
            ok = bool((services.get(service_key, {}) or {}).get("health_ok"))
            detail = "ok" if ok else f"down:{service_key}"
        elif collector_type == "service_group":
            service_keys = [
                str(value).strip()
                for value in collector.get("service_keys", [])
                if str(value).strip()
            ]
            ok = len(service_keys) > 0 and all(
                bool((services.get(service_key, {}) or {}).get("health_ok"))
                for service_key in service_keys
            )
            detail = "ok" if ok else "partial"
        elif collector_type == "command":
            source = str(collector.get("source", "")).strip()
            ok = bool(source) and Path(source).exists()
            detail = "present" if ok else "missing"
        collector_rows.append(
            {
                "collector_id": collector.get("collector_id"),
                "type": collector_type,
                "color_state": to_color(ok),
                "detail": detail,
            }
        )

    collectors = catalog_health(collectors_doc, "collectors")
    collector_green_total = len(
        [collector for collector in collector_rows if collector.get("color_state") == "green"]
    )
    collectors.update(
        {
            "green_total": collector_green_total,
            "red_total": len(collector_rows) - collector_green_total,
            "rows": collector_rows,
            "color_state": to_color(
                collectors["gap_total"] == 0
                and len(collector_rows) > 0
                and collector_green_total == len(collector_rows)
            ),
        }
    )

    cloud_rows: list[dict[str, Any]] = []
    for target in cloud_targets:
        service_key = str(target.get("service_key", "")).strip()
        probe_url = str(target.get("probe_url", "")).strip()
        required_reachability = bool(target.get("required_reachability", True))
        probe = http_probe(probe_url) if probe_url else {}
        service = services.get(service_key, {}) or {}
        service_ok = bool(service.get("health_ok"))
        ok = bool(probe.get("ok")) if probe_url else service_ok
        if not required_reachability:
            ok = True

        if probe_url:
            detail = cloud_probe_detail(target, probe)
        elif service_key:
            health = service.get("health") or {}
            detail = str(health.get("service") or health.get("status") or service_key)
        else:
            detail = str(target.get("profile") or "unconfigured")

        cloud_rows.append(
            {
                "target_id": target.get("target_id"),
                "profile": target.get("profile"),
                "service_key": service_key,
                "probe_url": probe_url or None,
                "required_reachability": required_reachability,
                "detail": detail,
                "color_state": to_color(ok),
            }
        )

    cloud_target_manager = catalog_health(cloud_doc, "targets")
    cloud_green_total = len([row for row in cloud_rows if row.get("color_state") == "green"])
    cloud_target_manager.update(
        {
            "green_total": cloud_green_total,
            "red_total": len(cloud_rows) - cloud_green_total,
            "targets": cloud_rows,
            "color_state": to_color(
                cloud_target_manager["gap_total"] == 0
                and len(cloud_rows) > 0
                and cloud_green_total == len(cloud_rows)
            ),
        }
    )

    overall_green = (
        engine_registry["color_state"] == "green"
        and adapter_registry["color_state"] == "green"
        and server_registry["color_state"] == "green"
        and room_router["color_state"] == "green"
        and actions_api["color_state"] == "green"
        and collectors["color_state"] == "green"
        and cloud_target_manager["color_state"] == "green"
    )

    return {
        "desired_state": manifest_doc.get("desired_state", "unknown"),
        "observed_state": manifest_doc.get("observed_state", "unknown"),
        "route_target": route_target,
        "engine_registry": engine_registry,
        "adapter_registry": adapter_registry,
        "server_registry": server_registry,
        "room_router": room_router,
        "actions_api": actions_api,
        "collectors": collectors,
        "cloud_target_manager": cloud_target_manager,
        "color_state": to_color(overall_green),
    }


def services_snapshot() -> dict[str, Any]:
    node_endpoints = {
        str(node.get("node_id", "")).strip(): str(node.get("endpoint", "")).rstrip("/")
        for node in read_json(NODES_FILE, {"nodes": []}).get("nodes", [])
        if str(node.get("node_id", "")).strip()
    }
    linux_endpoint = node_endpoints.get("mcp-linux-admin-local", "http://127.0.0.1:8877")
    voice_endpoint = node_endpoints.get("mcp-voice-local", "http://127.0.0.1:8790")
    time_endpoint = node_endpoints.get("mcp-time-calendar-ai-room", "http://127.0.0.1:8792")

    mcp_linux = http_json(f"{linux_endpoint}/health") if linux_endpoint else {}
    mcp_voice = http_json(f"{voice_endpoint}/health") if voice_endpoint else {}
    mcp_time_calendar = http_json(f"{time_endpoint}/health") if time_endpoint else {}
    netdata_endpoint = "http://127.0.0.1:19999/api/v1/info"
    clickhouse_endpoint = "http://127.0.0.1:8123/ping"
    gateway_endpoint = "http://127.0.0.1:46080"
    netdata_payload = http_json(netdata_endpoint)
    clickhouse_up = http_text(clickhouse_endpoint).strip().lower() == "ok."
    gateway_health = http_json(f"{gateway_endpoint}/health")
    radar_present = RADAR_SURFACE.exists()
    tenderly_present = command_exists("tenderly")
    octosql_present = command_exists("octosql")
    steampipe_present = command_exists("steampipe")
    openhands_state = docker_state("openhands-app")
    vllm_state = docker_state("vllm-openai")
    return {
        "openhands": {
            "container": "openhands-app",
            "state": openhands_state,
            "color_state": to_color(openhands_state == "running"),
        },
        "vllm": {
            "container": "vllm-openai",
            "state": vllm_state,
            "optional": True,
            "color_state": to_color(vllm_state in {"running", "not_found"}),
        },
        "mcp_linux_admin": {
            "endpoint": linux_endpoint,
            "health_ok": health_is_ok(mcp_linux, "mcp-linux-admin"),
            "color_state": to_color(health_is_ok(mcp_linux, "mcp-linux-admin")),
            "health": mcp_linux or None,
        },
        "mcp_voice_agent": {
            "endpoint": voice_endpoint,
            "health_ok": health_is_ok(mcp_voice, "mcp-voice-agent"),
            "color_state": to_color(health_is_ok(mcp_voice, "mcp-voice-agent")),
            "health": mcp_voice or None,
        },
        "mcp_time_calendar_agent": {
            "endpoint": time_endpoint,
            "health_ok": health_is_ok(mcp_time_calendar, "mcp-time-calendar-agent"),
            "color_state": to_color(
                health_is_ok(mcp_time_calendar, "mcp-time-calendar-agent")
            ),
            "health": mcp_time_calendar or None,
        },
        "agentgateway": {
            "endpoint": gateway_endpoint,
            "health_ok": health_is_ok(gateway_health, "vxstation-agentgateway"),
            "color_state": to_color(health_is_ok(gateway_health, "vxstation-agentgateway")),
            "health": gateway_health or None,
        },
        "netdata_cloud": {
            "endpoint": netdata_endpoint,
            "health_ok": bool(netdata_payload),
            "color_state": to_color(bool(netdata_payload)),
            "health": {
                "ok": bool(netdata_payload),
                "service": "netdata",
                "status": "ok" if netdata_payload else "down",
                "version": str(netdata_payload.get("version", "")).strip(),
            },
        },
        "clickhouse": {
            "endpoint": clickhouse_endpoint,
            "health_ok": clickhouse_up,
            "color_state": to_color(clickhouse_up),
            "health": {"service": "clickhouse", "status": "ok" if clickhouse_up else "down"},
        },
        "radar_surface": {
            "command": str(RADAR_SURFACE),
            "present": radar_present,
            "health_ok": radar_present,
            "color_state": to_color(radar_present),
        },
        "tenderly_cli": {
            "command": "tenderly",
            "present": tenderly_present,
            "health_ok": tenderly_present,
            "color_state": to_color(tenderly_present),
        },
        "octosql_cli": {
            "command": "octosql",
            "present": octosql_present,
            "health_ok": octosql_present,
            "color_state": to_color(octosql_present),
        },
        "steampipe_cli": {
            "command": "steampipe",
            "present": steampipe_present,
            "health_ok": steampipe_present,
            "color_state": to_color(steampipe_present),
        },
    }


def ops_status() -> dict[str, Any]:
    doc = read_json(OPS_STATUS_FILE, {})
    return {
        "overall_status": doc.get("overall_status", "unknown"),
        "updated_at": doc.get("updated_at"),
    }


def station_snapshot() -> dict[str, Any]:
    lanes = lane_snapshot()
    gate = count_gate()
    online = len([lane for lane in lanes if lane["online"]])
    bridge_nodes = bridge_snapshot()
    services = services_snapshot()
    vxstation_control = vxstation_control_snapshot(services)
    operation_room = operation_room_snapshot(services)
    central_brain = central_brain_snapshot(bridge_nodes)
    overall_green = (
        vxstation_control.get("color_state") == "green"
        and
        operation_room.get("color_state") == "green"
        and central_brain.get("color_state") == "green"
    )
    return {
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "radar": {
            "lanes_online": online,
            "lanes_total": len(lanes),
            "command_gate": gate,
            "ops_registry_status": ops_status().get("overall_status", "unknown"),
            "overall_status": to_color(overall_green),
        },
        "lanes": lanes,
        "modules": module_snapshot(),
        "topology": topology_snapshot(bridge_nodes),
        "vxstation_control": vxstation_control,
        "operation_room": operation_room,
        "central_brain": central_brain,
        "bridge_nodes": bridge_nodes,
        "services": services,
        "evidence": {
            "command_audit": str(COMMAND_AUDIT_FILE),
            "ops_status": str(OPS_STATUS_FILE),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="VYRDON/VYRDX Kitty station map")
    parser.add_argument("--pretty", action="store_true", help="Pretty JSON output")
    args = parser.parse_args()

    snapshot = station_snapshot()
    if args.pretty:
        print(json.dumps(snapshot, indent=2))
    else:
        print(json.dumps(snapshot))


if __name__ == "__main__":
    main()
