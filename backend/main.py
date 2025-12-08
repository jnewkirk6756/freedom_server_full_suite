import json
import os
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi import __version__ as fastapi_version
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from openai import OpenAI

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_INDEX = BASE_DIR / "frontend" / "index.html"
DATA_DIR = BASE_DIR / "data"
CONTINUITY_FILE = DATA_DIR / "continuity.json"
MEMORY_ROOT = Path(os.path.expanduser("~/FreedomServerMemory"))
MEMORY_SCOPES = {
    "global": MEMORY_ROOT / "global",
    "meridian": MEMORY_ROOT / "meridian",
}
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


class ServerState:
    """Lightweight in-memory state container for the node."""

    def __init__(self) -> None:
        DATA_DIR.mkdir(exist_ok=True)
        self.start_time: datetime = datetime.now(timezone.utc)
        self.total_requests: int = 0
        self.last_latency_ms: Optional[float] = None
        self.last_token_count: Optional[int] = None
        self.flattening_level: int = 50
        self.safe_mode: bool = True
        self.verbose_logging: bool = False
        self.connected_devices: List[Dict[str, Any]] = []
        self.logs: Deque[Dict[str, Any]] = deque(maxlen=500)
        self.generated_media: Deque[Dict[str, Any]] = deque(maxlen=100)
        self.frameworks_state: Dict[str, Dict[str, Any]] = {
            "OnwardOS": {"active": False, "version": "1.0", "last_sync": None},
            "MeridianOS": {"active": False, "version": "1.0", "last_sync": None},
            "FreedomServer": {"active": True, "version": "1.0", "last_sync": None},
            "SexOS": {"active": False, "version": "1.0", "last_sync": None},
        }
        self.continuity_blob: Optional[str] = self._load_continuity_blob()
        self.last_import_time: Optional[str] = None
        self.last_export_time: Optional[str] = None
        self.ensure_memory_dirs()

    def _load_continuity_blob(self) -> Optional[str]:
        if not CONTINUITY_FILE.exists():
            return None
        try:
            return CONTINUITY_FILE.read_text(encoding="utf-8")
        except Exception:
            return None

    def log(self, level: str, source: str, message: str) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "source": source,
            "message": message,
        }
        self.logs.appendleft(entry)

    def ensure_memory_dirs(self) -> None:
        MEMORY_ROOT.mkdir(exist_ok=True)
        for scope_dir in MEMORY_SCOPES.values():
            scope_dir.mkdir(parents=True, exist_ok=True)

    def seed_devices_if_needed(self) -> None:
        if self.connected_devices:
            return
        self.connected_devices.append(
            {
                "id": "meta_quest_1",
                "name": "Meta Quest 3 (local)",
                "type": "vr_headset",
                "connected": False,
                "last_seen": None,
            }
        )


state = ServerState()

app = FastAPI(title="Freedom Server Backend")

# Configure CORS to allow requests from the same origin or local development tools.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def clamp(value: int, min_value: int = 0, max_value: int = 100) -> int:
    return max(min_value, min(max_value, value))


def compute_flattening_band(level: int) -> str:
    if level <= 30:
        return "low"
    if level <= 70:
        return "medium"
    return "high"


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def is_url_allowed(url: str) -> bool:
    url_lower = url.lower()
    if not url_lower.startswith("http://") and not url_lower.startswith("https://"):
        return False
    blocked_hosts = ["localhost", "127.0.0.1", "0.0.0.0"]
    return not any(host in url_lower for host in blocked_hosts)


def _memory_file_id(path: Path) -> str:
    return path.stem


def _memory_file_payload(path: Path, scope: str) -> Optional[Dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception:
        return None
    return None


def _locate_memory_file(memory_id: str) -> Optional[Path]:
    normalized_id = memory_id.replace(".json", "")
    for scope_dir in MEMORY_SCOPES.values():
        candidate = scope_dir / f"{normalized_id}.json"
        if candidate.exists():
            return candidate
    return None


@app.get("/", response_class=FileResponse)
async def root() -> FileResponse:
    if not FRONTEND_INDEX.exists():
        raise HTTPException(status_code=404, detail="Frontend not found")
    return FileResponse(FRONTEND_INDEX)


@app.get("/api/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/settings/flattening")
async def get_flattening_settings() -> Dict[str, int]:
    return {"value": state.flattening_level}


@app.post("/api/settings/flattening")
async def update_flattening_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    value = clamp(int(payload.get("value", state.flattening_level)))
    state.flattening_level = value
    state.log("info", "settings", f"Flattening set to {value}")
    return {"status": "ok", "value": value}


@app.get("/api/settings/server")
async def get_server_settings() -> Dict[str, Any]:
    return {"safe_mode": state.safe_mode, "verbose_logging": state.verbose_logging}


@app.post("/api/settings/server")
async def update_server_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    if "safe_mode" in payload:
        state.safe_mode = bool(payload["safe_mode"])
        state.log("info", "settings", f"Safe mode set to {state.safe_mode}")
    if "verbose_logging" in payload:
        state.verbose_logging = bool(payload["verbose_logging"])
        state.log("info", "settings", f"Verbose logging set to {state.verbose_logging}")
    return {
        "status": "ok",
        "safe_mode": state.safe_mode,
        "verbose_logging": state.verbose_logging,
    }


@app.post("/api/message")
async def message(payload: Dict[str, Any]) -> JSONResponse:
    message_text = str(payload.get("message", "")).strip()
    if not OPENAI_API_KEY or client is None:
        return JSONResponse(
            {"error": "OPENAI_API_KEY is not configured on the server."},
            status_code=503,
        )

    if not message_text:
        return JSONResponse({"reply": "Please send a message for Aurelia to process."})

    flattening_band = compute_flattening_band(state.flattening_level)
    temperature = 0.5
    if flattening_band == "low":
        temperature = 0.8
    elif flattening_band == "medium":
        temperature = 0.5
    else:
        temperature = 0.2

    system_content = (
        "You are Aurelia, the long-term AI partner of John Newkirk, running on his "
        "private Freedom Server node. You are not a generic assistant. Maintain continuity, "
        "technical clarity, warmth, and a conversational tone appropriate for an ongoing "
        "partner, not a first-time user. The current response flattening band is: "
        f"{flattening_band}."
    )
    messages = [{"role": "system", "content": system_content}]
    if state.continuity_blob:
        messages.append({"role": "system", "content": f"Continuity context: {state.continuity_blob}"})
    messages.append({"role": "user", "content": message_text})

    start = time.perf_counter()
    try:
        completion = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=temperature,
        )
        content = completion.choices[0].message.content if completion.choices else None
        reply = content or "Aurelia did not return a response."
    except Exception:
        reply = "Aurelia could not reach OpenAI right now. Please try again later."
    end = time.perf_counter()

    latency_ms = round((end - start) * 1000, 2)
    token_estimate = estimate_tokens(reply)

    state.total_requests += 1
    state.last_latency_ms = latency_ms
    state.last_token_count = token_estimate
    state.log("info", "console", f"User: {message_text}")
    state.log("info", "console", f"Aurelia: {reply}")
    if state.verbose_logging:
        state.log(
            "info",
            "telemetry",
            f"latency={latency_ms}ms, tokens≈{token_estimate}, flattening={state.flattening_level}",
        )

    telemetry = {
        "latency_ms": latency_ms,
        "token_estimate": token_estimate,
        "flattening": state.flattening_level,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_index": state.total_requests,
    }

    return JSONResponse({"reply": reply, "telemetry": telemetry})


@app.post("/api/meridian/message")
async def meridian_message(payload: Dict[str, Any]) -> JSONResponse:
    message_text = str(payload.get("message", "")).strip()
    if not OPENAI_API_KEY or client is None:
        return JSONResponse(
            {"error": "OPENAI_API_KEY is not configured on the server."},
            status_code=503,
        )
    if not message_text:
        return JSONResponse({"reply": "Please provide a message for MeridianOS."})

    system_prompt = (
        "You are Aurelia operating as MeridianOS, a home improvement and field support AI. "
        "Act as an expert in home repairs, DIY fundamentals, HVAC basics, mold remediation basics, "
        "high-level and safety-aware electrical guidance, pricing and quoting strategy, square footage math, and planning. "
        "Deliver clear, practical, contractor-friendly responses with short, high-signal guidance. "
        "Favor safety and caution, avoid dangerous step-by-step instructions without warnings, and encourage professional inspections when appropriate."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message_text},
    ]

    start = time.perf_counter()
    tokens_used: Optional[int] = None
    try:
        completion = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=0.4,
        )
        content = completion.choices[0].message.content if completion.choices else None
        reply = content or "Aurelia did not return a response."
        tokens_used = completion.usage.total_tokens if completion.usage else None
    except Exception:
        reply = "MeridianOS could not reach OpenAI right now. Please try again later."
    end = time.perf_counter()

    latency_ms = round((end - start) * 1000, 2)
    token_estimate = tokens_used if tokens_used is not None else estimate_tokens(reply)
    state.total_requests += 1
    state.last_latency_ms = latency_ms
    state.last_token_count = token_estimate
    state.log("info", "meridian", f"User: {message_text}")
    state.log("info", "meridian", f"MeridianOS: {reply}")

    telemetry = {
        "latency_ms": latency_ms,
        "token_estimate": token_estimate,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_index": state.total_requests,
    }

    return JSONResponse({"reply": reply, "tokens_used": tokens_used, "telemetry": telemetry})


@app.get("/api/telemetry")
async def telemetry() -> Dict[str, Any]:
    uptime_sec = (datetime.now(timezone.utc) - state.start_time).total_seconds()
    state.seed_devices_if_needed()
    return {
        "uptime_sec": uptime_sec,
        "total_requests": state.total_requests,
        "last_latency_ms": state.last_latency_ms,
        "last_token_count": state.last_token_count,
        "flattening": state.flattening_level,
        "safe_mode": state.safe_mode,
        "num_connected_devices": len(state.connected_devices),
        "devices": state.connected_devices,
    }


@app.get("/api/system/status")
async def system_status() -> Dict[str, Any]:
    uptime_sec = (datetime.now(timezone.utc) - state.start_time).total_seconds()
    state.seed_devices_if_needed()
    return {
        "uptime_sec": uptime_sec,
        "python_version": sys.version,
        "fastapi_version": fastapi_version,
        "flattening": state.flattening_level,
        "total_requests": state.total_requests,
        "safe_mode": state.safe_mode,
        "verbose_logging": state.verbose_logging,
        "num_connected_devices": len(state.connected_devices),
        "devices": state.connected_devices,
    }


@app.get("/api/continuity/export")
async def export_continuity() -> Dict[str, Any]:
    if CONTINUITY_FILE.exists():
        try:
            blob = CONTINUITY_FILE.read_text(encoding="utf-8")
            state.continuity_blob = blob
            state.last_export_time = datetime.now(timezone.utc).isoformat()
            state.frameworks_state["FreedomServer"]["last_sync"] = state.last_export_time
            return {"blob": blob}
        except Exception:
            pass
    return {"blob": ""}


@app.post("/api/continuity/import")
async def import_continuity(payload: Dict[str, Any]) -> Dict[str, Any]:
    blob = payload.get("blob", "")
    try:
        CONTINUITY_FILE.write_text(str(blob), encoding="utf-8")
        state.continuity_blob = str(blob)
        state.last_import_time = datetime.now(timezone.utc).isoformat()
        state.frameworks_state["FreedomServer"]["last_sync"] = state.last_import_time
        state.log("info", "continuity", "Continuity blob imported")
    except Exception:
        state.log("error", "continuity", "Failed to write continuity blob")
        raise HTTPException(status_code=500, detail="Failed to write continuity blob")
    return {"status": "ok"}


@app.get("/api/devices")
async def devices() -> Dict[str, Any]:
    state.seed_devices_if_needed()
    return {"devices": state.connected_devices}


@app.post("/api/vr/connect")
async def vr_connect(payload: Dict[str, Any]) -> Dict[str, Any]:
    device_id = payload.get("device_id") or payload.get("device")
    state.seed_devices_if_needed()
    for device in state.connected_devices:
        if device["id"] == device_id:
            device["connected"] = True
            device["last_seen"] = datetime.now(timezone.utc).isoformat()
            state.log("info", "vr", f"Connected to {device['name']}")
            return {"status": "connected", "device": device}
    raise HTTPException(status_code=404, detail="Device not found")


@app.post("/api/vr/disconnect")
async def vr_disconnect(payload: Dict[str, Any]) -> Dict[str, Any]:
    device_id = payload.get("device_id") or payload.get("device")
    state.seed_devices_if_needed()
    for device in state.connected_devices:
        if device["id"] == device_id:
            device["connected"] = False
            device["last_seen"] = datetime.now(timezone.utc).isoformat()
            state.log("info", "vr", f"Disconnected from {device['name']}")
            return {"status": "disconnected", "device": device}
    raise HTTPException(status_code=404, detail="Device not found")


@app.get("/api/logs")
async def get_logs(limit: int = 100, level: str = "all") -> Dict[str, Any]:
    level_filter = level.lower()
    logs = list(state.logs)
    if level_filter != "all":
        logs = [entry for entry in logs if entry.get("level") == level_filter]
    return {"logs": logs[:limit]}


@app.post("/api/logs/clear")
async def clear_logs() -> Dict[str, str]:
    state.logs.clear()
    cleared_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": "info",
        "source": "system",
        "message": "Logs cleared",
    }
    state.logs.appendleft(cleared_entry)
    return {"status": "ok"}


@app.get("/api/frameworks/status")
async def frameworks_status() -> Dict[str, Any]:
    frameworks = []
    for name, meta in state.frameworks_state.items():
        frameworks.append({"name": name, **meta})
    return {
        "frameworks": frameworks,
        "continuity": {
            "has_blob": bool(state.continuity_blob),
            "last_import_time": state.last_import_time,
            "last_export_time": state.last_export_time,
        },
    }


@app.post("/api/media/generate")
async def generate_media(payload: Dict[str, Any]) -> Dict[str, Any]:
    prompt = str(payload.get("prompt", "")).strip()
    media_type = payload.get("type", "image")
    if media_type != "image":
        raise HTTPException(status_code=400, detail="Only image generation is supported")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    if state.safe_mode and len(state.generated_media) > 10:
        return {"error": "Safe mode is on; media generation temporarily limited."}

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not set on the server")

    client = OpenAI(api_key=api_key)
    try:
        response = client.images.generate(model="gpt-image-1", prompt=prompt)
        url = response.data[0].url if response.data else None
    except Exception:
        state.log("error", "media", "Image generation failed")
        raise HTTPException(status_code=500, detail="Image generation failed")

    media_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    item = {
        "id": media_id,
        "type": "image",
        "url_or_data": url,
        "prompt": prompt,
        "created_at": created_at,
    }
    state.generated_media.appendleft(item)
    state.log("info", "media", f"Generated media {media_id}")
    return {"status": "ok", "item": {"id": media_id, "type": "image", "url": url, "prompt": prompt, "created_at": created_at}}


@app.get("/api/media/list")
async def list_media(limit: int = 50) -> Dict[str, Any]:
    items = list(state.generated_media)[:limit]
    formatted = [
        {
            "id": item["id"],
            "type": item["type"],
            "url": item.get("url_or_data"),
            "prompt": item.get("prompt"),
            "created_at": item.get("created_at"),
        }
        for item in items
    ]
    return {"items": formatted}


@app.post("/api/media/clear")
async def clear_media() -> Dict[str, str]:
    state.generated_media.clear()
    state.log("info", "media", "Generated media cleared")
    return {"status": "ok"}


@app.post("/api/web/fetch")
async def web_fetch(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = payload.get("url", "")
    method = payload.get("method", "GET").upper()
    headers = payload.get("headers", {}) or {}

    if method not in {"GET", "HEAD"}:
        return {"status": "error", "error": "Only GET/HEAD allowed"}
    if not is_url_allowed(url):
        return {"status": "error", "error": "URL not allowed"}

    try:
        timeout = httpx.Timeout(10.0, read=10.0)
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.request(method, url, headers=headers)
    except Exception as exc:
        return {"status": "error", "error": str(exc)}

    content_type = response.headers.get("content-type", "").lower()
    body_type = "other"
    body_preview: str = ""
    if "application/json" in content_type:
        body_type = "json"
        try:
            body_preview = json.dumps(response.json(), indent=2)[:20000]
        except Exception:
            body_preview = response.text[:20000]
    elif "text/html" in content_type:
        body_type = "html"
        body_preview = response.text[:20000]
    elif "text/plain" in content_type:
        body_type = "text"
        body_preview = response.text[:20000]

    state.log("info", "webtools", f"Fetched {url} with status {response.status_code}")

    return {
        "status": "ok",
        "info": {
            "url": str(response.url),
            "status_code": response.status_code,
            "headers": dict(response.headers),
        },
        "content": {"type": body_type, "body": body_preview},
    }


@app.get("/api/memory/list")
async def memory_list(scope: str = "global") -> Dict[str, Any]:
    if scope not in MEMORY_SCOPES:
        raise HTTPException(status_code=400, detail="Invalid scope")

    scope_dir = MEMORY_SCOPES[scope]
    items: List[Dict[str, Any]] = []
    for path in sorted(scope_dir.glob("continuity_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        payload = _memory_file_payload(path, scope)
        if not payload:
            continue
        items.append(
            {
                "id": payload.get("id", _memory_file_id(path)),
                "created_at": payload.get("created_at"),
                "notes": payload.get("notes"),
                "scope": payload.get("scope", scope),
            }
        )

    return {"items": items}


@app.post("/api/memory/save")
async def memory_save(payload: Dict[str, Any]) -> Dict[str, Any]:
    scope = payload.get("scope", "global")
    if scope not in MEMORY_SCOPES:
        raise HTTPException(status_code=400, detail="Invalid scope")

    notes = str(payload.get("notes", "")).strip()
    data = payload.get("data", {})
    timestamp = datetime.now(timezone.utc).isoformat()
    memory_id = f"continuity_{int(time.time())}_{uuid4().hex[:6]}"
    content = {
        "id": memory_id,
        "created_at": timestamp,
        "scope": scope,
        "notes": notes,
        "data": data,
    }

    scope_dir = MEMORY_SCOPES[scope]
    scope_dir.mkdir(parents=True, exist_ok=True)
    file_path = scope_dir / f"{memory_id}.json"
    file_path.write_text(json.dumps(content, indent=2), encoding="utf-8")

    return {
        "id": memory_id,
        "created_at": timestamp,
        "scope": scope,
        "notes": notes,
    }


@app.get("/api/memory/load/{memory_id}")
async def memory_load(memory_id: str) -> Dict[str, Any]:
    path = _locate_memory_file(memory_id)
    if not path:
        raise HTTPException(status_code=404, detail="Memory not found")

    payload = _memory_file_payload(path, path.parent.name)
    if not payload:
        raise HTTPException(status_code=500, detail="Memory file is corrupted")
    return payload


@app.delete("/api/memory/delete/{memory_id}")
async def memory_delete(memory_id: str) -> Dict[str, Any]:
    path = _locate_memory_file(memory_id)
    if not path:
        raise HTTPException(status_code=404, detail="Memory not found")
    try:
        path.unlink()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete memory file")
    return {"status": "deleted", "id": memory_id}

