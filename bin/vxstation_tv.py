#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from vxstation_runtime import ROOT, resolve_python

DASHBOARD = ROOT / "bin" / "vxstation_dashboard.py"
TV_STATE = ROOT / "state" / "tv"
TV_LOG = TV_STATE / "vxstation-tv.log"
STABILITY_SECONDS = float(os.environ.get("VXSTATION_TV_STABILITY_SECONDS", "6"))


def resolve_binary(name: str, fallback: Path | None = None) -> str | None:
    path = shutil.which(name)
    if path:
        return path
    if fallback and fallback.exists():
        return str(fallback)
    return None


def dashboard_running() -> bool:
    result = subprocess.run(
        ["pgrep", "-af", "vxstation_dashboard.py"],
        capture_output=True,
        text=True,
        check=False,
    )
    lines = [
        line
        for line in result.stdout.splitlines()
        if line.strip() and "kitty --detach" not in line
    ]
    return result.returncode == 0 and bool(lines)


def tv_window_running() -> bool:
    result = subprocess.run(
        ["pgrep", "-af", "VXSTATION TV"],
        capture_output=True,
        text=True,
        check=False,
    )
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    return result.returncode == 0 and bool(lines)


def main() -> int:
    python_bin = resolve_python()
    kitty_bin = resolve_binary("kitty", Path("/home/t79/generic/.local/kitty.app/bin/kitty"))
    if not kitty_bin:
        print("missing kitty binary", file=sys.stderr)
        return 1

    TV_STATE.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT / "bin")
    dashboard_argv = [python_bin, str(DASHBOARD)]

    argv = [
        kitty_bin,
        "--detach",
        "--detached-log",
        str(TV_LOG),
        "--directory",
        str(ROOT),
        "--title",
        "VXSTATION TV",
        "--override",
        "remember_window_size=no",
        "--override",
        "initial_window_width=220c",
        "--override",
        "initial_window_height=62c",
        *dashboard_argv,
    ]
    launch = subprocess.run(
        argv,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        env=env,
        cwd=ROOT,
        check=False,
    )
    if launch.returncode == 0:
        for _ in range(25):
            if dashboard_running() and tv_window_running():
                break
            time.sleep(0.2)
        else:
            print("vxstation tv failed to stay up", file=sys.stderr)
            if TV_LOG.exists():
                print(TV_LOG.read_text("utf-8", errors="ignore")[-4000:], file=sys.stderr)
            return 1

        deadline = time.time() + STABILITY_SECONDS
        while time.time() < deadline:
            if not dashboard_running() or not tv_window_running():
                print("vxstation tv failed to stay up", file=sys.stderr)
                if TV_LOG.exists():
                    print(TV_LOG.read_text("utf-8", errors="ignore")[-4000:], file=sys.stderr)
                return 1
            time.sleep(0.25)

        print("vxstation tv launched")
        return 0

    if sys.stdout.isatty():
        return subprocess.run(dashboard_argv, env=env, cwd=ROOT, check=False).returncode

    print(f"kitty detached launch failed with exit code {launch.returncode}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
