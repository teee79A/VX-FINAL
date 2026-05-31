#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from vxstation_runtime import ROOT, resolve_python

SURFACE_APP = ROOT / "bin" / "vxstation_radar.py"
SURFACE_STATE = ROOT / "state" / "surfaces"

ROOM_TITLES = {
    "brain": "VXSTATION SZH CENTRAL BRAIN",
    "operation": "VXSTATION OPERATION ROOM",
    "commercial": "VXSTATION COMMERCIAL ROOM",
    "archive": "VXSTATION ARCHIVING ROOM",
    "feedback": "VXSTATION FEEDBACK CLOUD",
    "radar": "VXSTATION RADAR",
}


def resolve_binary(name: str, fallback: Path | None = None) -> str | None:
    path = shutil.which(name)
    if path:
        return path
    if fallback and fallback.exists():
        return str(fallback)
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch a detached VXSTATION room surface")
    parser.add_argument(
        "room",
        choices=sorted(ROOM_TITLES),
        help="Room surface to open.",
    )
    parser.add_argument(
        "layer",
        nargs="?",
        default="",
        help="Optional room layer to preselect.",
    )
    return parser.parse_args()


def target_running(room: str) -> bool:
    pattern = f"vxstation_radar.py --room {room}"
    result = subprocess.run(
        ["pgrep", "-af", pattern],
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


def main() -> int:
    args = parse_args()
    python_bin = resolve_python()
    kitty_bin = resolve_binary("kitty", Path("/home/t79/generic/.local/kitty.app/bin/kitty"))
    if not kitty_bin:
        print("missing kitty binary", file=sys.stderr)
        return 1

    SURFACE_STATE.mkdir(parents=True, exist_ok=True)
    log_file = SURFACE_STATE / f"{args.room}.surface.log"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT / "bin")

    surface_argv = [python_bin, str(SURFACE_APP), "--room", args.room]
    if args.layer:
        surface_argv.extend(["--layer", args.layer])

    argv = [
        kitty_bin,
        "--detach",
        "--detached-log",
        str(log_file),
        "--directory",
        str(ROOT),
        "--title",
        ROOM_TITLES[args.room],
        "--override",
        "remember_window_size=no",
        "--override",
        "initial_window_width=210c",
        "--override",
        "initial_window_height=62c",
        *surface_argv,
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
            if target_running(args.room):
                target = f"{args.room}/{args.layer}" if args.layer else args.room
                print(f"vxstation surface launched: {target}")
                return 0
            time.sleep(0.2)

        print(f"vxstation surface failed to stay up: {args.room}", file=sys.stderr)
        if log_file.exists():
            print(log_file.read_text("utf-8", errors="ignore")[-4000:], file=sys.stderr)
        return 1

        target = f"{args.room}/{args.layer}" if args.layer else args.room

    if sys.stdout.isatty():
        return subprocess.run(surface_argv, env=env, cwd=ROOT, check=False).returncode

    print(f"kitty detached launch failed with exit code {launch.returncode}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
