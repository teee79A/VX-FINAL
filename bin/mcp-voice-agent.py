#!/usr/bin/env python3
import json
import mimetypes
import os
import shutil
import subprocess
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import error, request

HOST = os.environ.get("KITTY_MCP_VOICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("KITTY_MCP_VOICE_PORT", "8790"))
AUTH_TOKEN = os.environ.get("KITTY_MCP_VOICE_TOKEN", "")

OUTPUT_DIR = Path(
    os.environ.get(
        "KITTY_MCP_VOICE_OUTPUT_DIR", "/home/t79/KITTY/evidence/voice_outputs"
    )
)
REGISTRY_FILE = OUTPUT_DIR / "voice_registry.json"

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_BASE_URL = os.environ.get("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io/v1")
ELEVENLABS_MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

COQUI_TTS_BIN = os.environ.get("COQUI_TTS_BIN", "tts")
COQUI_MODEL_NAME = os.environ.get(
    "COQUI_MODEL_NAME", "tts_models/en/ljspeech/tacotron2-DDC"
)

VOICE_ALLOWED_IDENTITIES = {
    item.strip()
    for item in os.environ.get("KITTY_VOICE_ALLOWED_IDENTITIES", "").split(",")
    if item.strip()
}
VOICE_CONSENT_TOKEN = os.environ.get("KITTY_VOICE_CONSENT_TOKEN", "")

ALLOWED_INTENTS = {
    "voice.clone.create",
    "voice.tts.speak",
    "voice.tts.status",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def read_registry() -> dict[str, Any]:
    ensure_dirs()
    if not REGISTRY_FILE.exists():
        return {"voices": []}
    try:
        return json.loads(REGISTRY_FILE.read_text("utf-8"))
    except Exception:
        return {"voices": []}


def write_registry(data: dict[str, Any]) -> None:
    ensure_dirs()
    REGISTRY_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def add_registry_voice(record: dict[str, Any]) -> None:
    data = read_registry()
    voices = data.get("voices", [])
    voices = [item for item in voices if item.get("voice_id") != record.get("voice_id")]
    voices.append(record)
    data["voices"] = voices
    write_registry(data)


def run_local_command(argv: list[str]) -> tuple[int, str]:
    proc = subprocess.run(argv, capture_output=True, text=True)
    output = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, output.strip()


def has_coqui() -> bool:
    return shutil.which(COQUI_TTS_BIN) is not None


def validate_auth(handler: BaseHTTPRequestHandler) -> bool:
    if not AUTH_TOKEN:
        return True
    return handler.headers.get("x-kitty-token", "") == AUTH_TOKEN


def validate_intent(body: dict[str, Any]) -> tuple[bool, str]:
    intent = str(body.get("intent", ""))
    if intent not in ALLOWED_INTENTS:
        return False, f"Intent not allowed: {intent}"
    return True, ""


def validate_clone_policy(payload: dict[str, Any]) -> tuple[bool, str]:
    owner_name = str(payload.get("owner_name", "")).strip()
    sample_paths = payload.get("sample_paths", [])
    consent_token = str(payload.get("consent_token", "")).strip()

    if not owner_name:
        return False, "owner_name is required."
    if not isinstance(sample_paths, list) or not sample_paths:
        return False, "sample_paths must be a non-empty array."
    if VOICE_ALLOWED_IDENTITIES and owner_name not in VOICE_ALLOWED_IDENTITIES:
        return False, f"owner_name is not in allowlist: {owner_name}"
    if VOICE_CONSENT_TOKEN and consent_token != VOICE_CONSENT_TOKEN:
        return False, "consent_token mismatch."

    for item in sample_paths:
        if not isinstance(item, str) or not item.strip():
            return False, "sample_paths entries must be file paths."
        if not Path(item).expanduser().exists():
            return False, f"sample file does not exist: {item}"
    return True, ""


def choose_tts_provider(payload: dict[str, Any]) -> str:
    requested = str(payload.get("provider", "")).strip().lower()
    if requested in {"elevenlabs", "coqui"}:
        return requested
    if ELEVENLABS_API_KEY:
        return "elevenlabs"
    if has_coqui():
        return "coqui"
    return "none"


def build_multipart_form(fields: dict[str, str], files: list[tuple[str, Path]]) -> tuple[str, bytes]:
    boundary = f"----KittyVoice{uuid.uuid4().hex}"
    lines: list[bytes] = []
    for key, value in fields.items():
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
        )

    for field_name, file_path in files:
        filename = file_path.name
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(
            (
                f'Content-Disposition: form-data; name="{field_name}"; '
                f'filename="{filename}"\r\n'
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode()
        )
        lines.append(file_path.read_bytes())
        lines.append(b"\r\n")

    lines.append(f"--{boundary}--\r\n".encode())
    return boundary, b"".join(lines)


def http_json(
    method: str,
    url: str,
    payload: dict[str, Any],
    headers: dict[str, str],
) -> tuple[int, dict[str, Any]]:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(url, method=method, data=body)
    for key, value in headers.items():
        req.add_header(key, value)
    req.add_header("content-type", "application/json")
    try:
        with request.urlopen(req, timeout=45) as res:
            data = res.read().decode("utf-8")
            return res.status, (json.loads(data) if data else {})
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(raw) if raw else {}
        except Exception:
            parsed = {"error": raw or f"http_error_{exc.code}"}
        return exc.code, parsed


def elevenlabs_clone(payload: dict[str, Any]) -> tuple[bool, str, dict[str, Any]]:
    if not ELEVENLABS_API_KEY:
        return False, "ELEVENLABS_API_KEY is missing.", {}

    owner_name = str(payload["owner_name"]).strip()
    clone_name = str(payload.get("clone_name", owner_name)).strip() or owner_name
    description = str(payload.get("description", f"VYRDON profile for {owner_name}")).strip()
    sample_paths = [Path(item).expanduser() for item in payload.get("sample_paths", [])]

    fields = {"name": clone_name, "description": description}
    file_parts = [("files", sample) for sample in sample_paths]
    boundary, body = build_multipart_form(fields, file_parts)

    req = request.Request(
        f"{ELEVENLABS_BASE_URL}/voices/add",
        method="POST",
        data=body,
        headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "content-type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with request.urlopen(req, timeout=90) as res:
            raw = res.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        return False, details or f"clone_http_error_{exc.code}", {}
    except Exception as exc:
        return False, str(exc), {}

    voice_id = str(data.get("voice_id", "")).strip()
    if not voice_id:
        return False, "clone response missing voice_id", data

    record = {
        "voice_id": voice_id,
        "owner_name": owner_name,
        "clone_name": clone_name,
        "provider": "elevenlabs",
        "created_at": utc_now(),
    }
    add_registry_voice(record)
    return True, "voice_clone_created", {"voice_id": voice_id, "owner_name": owner_name}


def elevenlabs_tts(payload: dict[str, Any]) -> tuple[bool, str, dict[str, Any]]:
    if not ELEVENLABS_API_KEY:
        return False, "ELEVENLABS_API_KEY is missing.", {}

    text = str(payload.get("text", "")).strip()
    voice_id = str(payload.get("voice_id", "")).strip()
    if not text:
        return False, "text is required.", {}
    if not voice_id:
        return False, "voice_id is required for elevenlabs.", {}

    output_file = str(payload.get("output_file", "")).strip()
    if not output_file:
        output_file = str(OUTPUT_DIR / f"tts_{int(time.time() * 1000)}.mp3")
    output_path = Path(output_file).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tts_payload = {
        "text": text,
        "model_id": str(payload.get("model_id", ELEVENLABS_MODEL_ID)),
    }

    req = request.Request(
        f"{ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}",
        method="POST",
        data=json.dumps(tts_payload).encode("utf-8"),
        headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "content-type": "application/json",
            "accept": "audio/mpeg",
        },
    )
    try:
        with request.urlopen(req, timeout=90) as res:
            audio = res.read()
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        return False, details or f"tts_http_error_{exc.code}", {}
    except Exception as exc:
        return False, str(exc), {}

    output_path.write_bytes(audio)
    return True, "tts_generated", {"provider": "elevenlabs", "output_file": str(output_path)}


def coqui_tts(payload: dict[str, Any]) -> tuple[bool, str, dict[str, Any]]:
    if not has_coqui():
        return False, f"{COQUI_TTS_BIN} is not installed.", {}

    text = str(payload.get("text", "")).strip()
    if not text:
        return False, "text is required.", {}

    output_file = str(payload.get("output_file", "")).strip()
    if not output_file:
        output_file = str(OUTPUT_DIR / f"tts_{int(time.time() * 1000)}.wav")
    output_path = Path(output_file).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    model_name = str(payload.get("model_name", COQUI_MODEL_NAME))
    code, output = run_local_command(
        [
            COQUI_TTS_BIN,
            "--text",
            text,
            "--model_name",
            model_name,
            "--out_path",
            str(output_path),
        ]
    )
    if code != 0:
        return False, output or "coqui_tts_failed", {}

    return True, "tts_generated", {"provider": "coqui", "output_file": str(output_path)}


def handle_intent(body: dict[str, Any]) -> tuple[bool, str, dict[str, Any]]:
    intent = str(body.get("intent", ""))
    payload = body.get("payload", {}) or {}

    if intent == "voice.tts.status":
        return (
            True,
            "voice_lane_ready",
            {
                "providers": {
                    "elevenlabs": bool(ELEVENLABS_API_KEY),
                    "coqui": has_coqui(),
                },
                "output_dir": str(OUTPUT_DIR),
                "registry_file": str(REGISTRY_FILE),
            },
        )

    if intent == "voice.clone.create":
        ok, reason = validate_clone_policy(payload)
        if not ok:
            return False, reason, {}
        provider = str(payload.get("provider", "elevenlabs")).strip().lower()
        if provider != "elevenlabs":
            return False, "voice.clone.create currently supports provider=elevenlabs only.", {}
        return elevenlabs_clone(payload)

    provider = choose_tts_provider(payload)
    if provider == "elevenlabs":
        return elevenlabs_tts(payload)
    if provider == "coqui":
        return coqui_tts(payload)
    return False, "No TTS provider available (ElevenLabs key missing and Coqui not installed).", {}


class Handler(BaseHTTPRequestHandler):
    def write_json(self, code: int, payload: dict[str, Any]) -> None:
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
                "service": "mcp-voice-agent",
                "time": int(time.time() * 1000),
                "providers": {
                    "elevenlabs": bool(ELEVENLABS_API_KEY),
                    "coqui": has_coqui(),
                },
            },
        )

    def do_POST(self) -> None:
        if self.path != "/dispatch":
            self.write_json(404, {"accepted": False, "error": "not_found"})
            return

        if not validate_auth(self):
            self.write_json(401, {"accepted": False, "error": "unauthorized"})
            return

        try:
            raw = self.rfile.read(int(self.headers.get("content-length", "0")))
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            self.write_json(400, {"accepted": False, "error": "invalid_json"})
            return

        ok, reason = validate_intent(body)
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
    ensure_dirs()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"mcp-voice-agent listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
