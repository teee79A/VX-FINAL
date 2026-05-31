from __future__ import annotations

import shutil
import sys
from pathlib import Path


ROOT = Path("/home/t79/KITTY")
VENV_PYTHON = ROOT / ".venv" / "bin" / "python3"


def resolve_python() -> str:
    if VENV_PYTHON.exists():
        return str(VENV_PYTHON)
    if sys.executable:
        return sys.executable

    fallback = shutil.which("python3") or shutil.which("python")
    if fallback:
        return fallback

    raise FileNotFoundError("python runtime unavailable")
