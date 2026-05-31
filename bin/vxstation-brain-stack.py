#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import importlib
from importlib import metadata
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
NODE_MODULES = ROOT / "node_modules"
PATH_PREFIXES = [
    str(ROOT / ".venv" / "bin"),
    str(ROOT / "node_modules" / ".bin"),
    str(Path.home() / ".local" / "bin"),
    str(Path.home() / ".local" / "npm" / "bin"),
    str(Path.home() / ".cargo" / "bin"),
    str(Path.home() / ".npm-global" / "bin"),
]
ANSI_RE = re.compile(r"\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

PACKAGE_MAP = {
    "langgraph": "langgraph",
    "autogen-agentchat": "autogen_agentchat",
    "autogen-ext": "autogen_ext",
    "composio": "composio",
    "python-dotenv": "dotenv",
}

NODE_PACKAGES = {
    "@aiondadotcom/mcp-ssh": ROOT / "node_modules" / "@aiondadotcom" / "mcp-ssh" / "package.json",
}

COMMAND_MAP = {
    "node": {"argv": ["node", "--version"], "mode": "exec", "required": True},
    "npm": {"argv": ["npm", "--version"], "mode": "exec", "required": True},
    "openai": {"argv": ["openai", "--version"], "mode": "exec", "required": True},
    "mcp": {"argv": ["mcp", "--help"], "mode": "exec", "required": True},
    "mcp-ssh": {"argv": [str(ROOT / "node_modules" / ".bin" / "mcp-ssh")], "mode": "exists", "required": True},
    "notcurses-info": {"argv": ["notcurses-info"], "mode": "exec", "required": True},
    "mediamtx": {"argv": ["mediamtx", "--version"], "mode": "exec", "required": True},
    "zenith": {"argv": ["zenith", "--version"], "mode": "exec", "required": True},
    "calcure": {"argv": [str(ROOT / ".venv" / "bin" / "calcure"), "--version"], "mode": "exec", "required": False},
    "nats-server": {"argv": ["nats-server", "-v"], "mode": "exec", "required": False},
    "neure": {"argv": ["neure", "--help"], "mode": "exec", "required": False},
    "clansdr-central": {"argv": ["clansdr-central", "--help"], "mode": "exec", "required": False},
    "benthos": {"argv": ["benthos", "--version"], "mode": "exec", "required": False},
    "temporal": {"argv": ["temporal", "--version"], "mode": "exec", "required": False},
    "radar": {"argv": [str(ROOT / "bin" / "vxstation_radar.py")], "mode": "exists", "required": False},
    "tenderly": {"argv": ["tenderly", "version"], "mode": "exec", "required": False},
    "octosql": {"argv": ["octosql", "--version"], "mode": "exec", "required": False},
    "steampipe": {"argv": ["steampipe", "--version"], "mode": "exec", "required": False},
}

REGISTRY_PATHS = {
    "central_brain": ROOT / "SZH_CENTRAL_BRAIN" / "engine_registry.tsv",
    "operation_room": ROOT / "OPERATION_ROOM" / "engine_registry.tsv",
}


def _safe_run(argv: list[str], mode: str) -> dict[str, object]:
    lookup_path = os.pathsep.join(PATH_PREFIXES + [os.environ.get("PATH", "")])
    exe = shutil.which(argv[0], path=lookup_path) if not Path(argv[0]).is_absolute() else argv[0]
    if not exe or not Path(exe).exists():
        return {"installed": False, "error": f"missing executable: {argv[0]}"}
    if mode == "exists":
        return {"installed": True, "path": exe}
    try:
        env = os.environ.copy()
        env["PATH"] = lookup_path
        if Path(argv[0]).name == "notcurses-info":
            env["TERM"] = "xterm-256color"
        result = subprocess.run(argv, capture_output=True, text=True, check=False, timeout=10, env=env)
    except Exception as exc:  # noqa: BLE001
        return {"installed": False, "path": exe, "error": str(exc)}
    cleaned_output = ANSI_RE.sub("", result.stdout or result.stderr).replace("\x1b(B", "").strip()
    output = cleaned_output.splitlines()
    version = output[0].strip() if output else None
    return {
        "installed": result.returncode == 0,
        "path": exe,
        "version": version,
        "returncode": result.returncode,
    }


def _load_node_packages() -> dict[str, dict[str, object]]:
    packages: dict[str, dict[str, object]] = {}
    for name, manifest in NODE_PACKAGES.items():
        if not manifest.exists():
            packages[name] = {"installed": False, "error": f"missing manifest: {manifest}"}
            continue
        payload = json.loads(manifest.read_text())
        packages[name] = {
            "installed": True,
            "version": payload.get("version"),
            "path": str(manifest),
            "bin": payload.get("bin"),
        }
    return packages


def _is_registry_target_available(target: str) -> tuple[bool, str]:
    if target.startswith("python://"):
        module_name = target.removeprefix("python://")
        return (importlib.util.find_spec(module_name) is not None, module_name)
    if target.startswith(("http://", "https://")):
        return (True, target)
    path = Path(target)
    return (path.exists(), str(path))


def _load_registries() -> dict[str, dict[str, object]]:
    registries: dict[str, dict[str, object]] = {}
    for name, path in REGISTRY_PATHS.items():
        rows: list[dict[str, object]] = []
        with path.open() as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            for row in reader:
                available, resolved = _is_registry_target_available(row["binary_or_home"])
                rows.append(
                    {
                        "engine_id": row["engine_id"],
                        "state": row["state"],
                        "target": row["binary_or_home"],
                        "role": row["role"],
                        "available": available,
                        "resolved_target": resolved,
                    }
                )
        active_rows = [row for row in rows if row["state"] == "active"]
        registries[name] = {
            "path": str(path),
            "total": len(rows),
            "active": len(active_rows),
            "available": sum(1 for row in active_rows if row["available"]),
            "missing": [row["engine_id"] for row in active_rows if not row["available"]],
            "engines": rows,
        }
    return registries


def build_report() -> dict[str, object]:
    packages: dict[str, dict[str, object]] = {}
    for dist_name, module_name in PACKAGE_MAP.items():
        try:
            module = importlib.import_module(module_name)
            version = metadata.version(dist_name)
            packages[dist_name] = {
                "installed": True,
                "version": version,
                "module": module.__name__,
                "path": str(Path(module.__file__).resolve()) if getattr(module, "__file__", None) else None,
            }
        except Exception as exc:  # noqa: BLE001
            packages[dist_name] = {
                "installed": False,
                "error": str(exc),
            }

    commands = {
        name: {**_safe_run(spec["argv"], spec["mode"]), "required": bool(spec.get("required", False))}
        for name, spec in COMMAND_MAP.items()
    }

    return {
        "root": str(ROOT),
        "python": sys.executable,
        "zsh": {
            "hub": str(ROOT / "shell" / "zsh" / "vxstation-automation-hub.zsh"),
            "hub_present": (ROOT / "shell" / "zsh" / "vxstation-automation-hub.zsh").exists(),
            "venv": str(ROOT / ".venv"),
            "node_modules": str(NODE_MODULES),
        },
        "packages": packages,
        "commands": commands,
        "node_packages": _load_node_packages(),
        "registries": _load_registries(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="VXSTATION local brain stack status")
    parser.add_argument("--check", action="store_true", help="Exit non-zero if any required package is missing.")
    args = parser.parse_args()

    report = build_report()
    print(json.dumps(report, indent=2, sort_keys=True))

    if args.check:
        missing = [name for name, payload in report["packages"].items() if not payload["installed"]]
        missing.extend(
            name
            for name, payload in report["commands"].items()
            if payload["required"] and not payload["installed"]
        )
        missing.extend(name for name, payload in report["node_packages"].items() if not payload["installed"])
        return 1 if missing else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
