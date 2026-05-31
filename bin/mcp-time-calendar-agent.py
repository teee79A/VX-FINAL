#!/usr/bin/env python3
import json
import os
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Tuple

HOST = os.environ.get("KITTY_MCP_TIME_CAL_HOST", "127.0.0.1")
PORT = int(os.environ.get("KITTY_MCP_TIME_CAL_PORT", "8792"))
AUTH_TOKEN = os.environ.get("KITTY_MCP_TIME_CAL_TOKEN", "")
STATE_FILE = Path(
    os.environ.get(
        "KITTY_MCP_TIME_CAL_STATE_FILE",
        "/home/t79/AI_ROOM/state/calendar_state.json",
    )
)

ALLOWED_INTENTS = {
    "time.state.now",
    "calendar.state.get",
    "calendar.state.upsert",
}


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_state_file() -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if STATE_FILE.exists():
        return
    initial = {
        "updated_at": now_utc(),
        "entries": [],
    }
    STATE_FILE.write_text(json.dumps(initial, indent=2), encoding="utf-8")


def read_state() -> Dict[str, Any]:
    ensure_state_file()
    try:
        return json.loads(STATE_FILE.read_text("utf-8"))
    except Exception:
        return {"updated_at": now_utc(), "entries": []}


def write_state(data: Dict[str, Any]) -> None:
    ensure_state_file()
    data["updated_at"] = now_utc()
    STATE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def validate_request(body: Dict[str, Any]) -> Tuple[bool, str]:
    intent = str(body.get("intent", ""))
    if intent not in ALLOWED_INTENTS:
        return False, f"Intent not allowed: {intent}"

    payload = body.get("payload", {}) or {}
    if intent == "calendar.state.upsert":
        at_utc = str(payload.get("atUtc", "")).strip()
        title = str(payload.get("title", "")).strip()
        if not at_utc:
            return False, "payload.atUtc is required"
        if not title:
            return False, "payload.title is required"
    return True, ""


def upsert_entry(payload: Dict[str, Any]) -> Dict[str, Any]:
    at_utc = str(payload.get("atUtc", "")).strip()
    title = str(payload.get("title", "")).strip()
    entry_id = str(payload.get("entry_id", "")).strip() or str(uuid.uuid4())

    state = read_state()
    entries = state.get("entries", [])
    if not isinstance(entries, list):
        entries = []

    normalized: Dict[str, Any] = {
        "entry_id": entry_id,
        "atUtc": at_utc,
        "title": title,
        "created_at": now_utc(),
    }

    replaced = False
    for index, item in enumerate(entries):
        if isinstance(item, dict) and item.get("entry_id") == entry_id:
            normalized["created_at"] = str(item.get("created_at", normalized["created_at"]))
            normalized["updated_at"] = now_utc()
            entries[index] = normalized
            replaced = True
            break

    if not replaced:
        normalized["updated_at"] = normalized["created_at"]
        entries.append(normalized)

    state["entries"] = entries
    write_state(state)
    return normalized


def handle_intent(body: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    intent = str(body.get("intent", ""))
    payload = body.get("payload", {}) or {}

    if intent == "time.state.now":
        return True, "time_state_now", {"now_utc": now_utc(), "epoch_ms": int(time.time() * 1000)}

    if intent == "calendar.state.get":
        state = read_state()
        return True, "calendar_state_loaded", state

    entry = upsert_entry(payload)
    return True, "calendar_state_upserted", {"entry": entry, "state_file": str(STATE_FILE)}


class Handler(BaseHTTPRequestHandler):
    def write_json(self, code: int, payload: Dict[str, Any]) -> None:
        wire = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(wire)))
        self.end_headers()
        self.wfile.write(wire)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.write_json(404, {"ok": False, "error": "not_found"})
            return
        self.write_json(
            200,
            {
                "ok": True,
                "service": "mcp-time-calendar-agent",
                "time": int(time.time() * 1000),
                "state_file": str(STATE_FILE),
                "ai_room_root": "/home/t79/AI_ROOM",
            },
        )

    def do_POST(self) -> None:
        if self.path != "/dispatch":
            self.write_json(404, {"accepted": False, "error": "not_found"})
            return

        if AUTH_TOKEN:
            token = self.headers.get("x-kitty-token", "")
            if token != AUTH_TOKEN:
                self.write_json(401, {"accepted": False, "error": "unauthorized"})
                return

        try:
            raw = self.rfile.read(int(self.headers.get("content-length", "0")))
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            self.write_json(400, {"accepted": False, "error": "invalid_json"})
            return

        ok, reason = validate_request(body)
        if not ok:
            self.write_json(403, {"accepted": False, "reason": reason})
            return

        accepted, message, data = handle_intent(body)
        self.write_json(
            200 if accepted else 500,
            {
                "accepted": accepted,
                "message": message,
                "intent": body.get("intent"),
                "dispatch_ref": body.get("dispatch_ref"),
                "data": data,
            },
        )

    def log_message(self, fmt: str, *args: Any) -> None:
        return


def main() -> None:
    ensure_state_file()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"mcp-time-calendar-agent listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
