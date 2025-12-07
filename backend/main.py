from __future__ import annotations

import json
import os
import re
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# -----------------------------
# Global State Management
# -----------------------------


class GlobalState:
    def __init__(self) -> None:
        self.start_time: datetime = datetime.utcnow()
        self.total_requests: int = 0
        self.last_latency_ms: Optional[float] = None
        self.last_token_count: Optional[int] = None
        self.flattening_level: int = 50
        self.safe_mode: bool = True
        self.verbose_logging: bool = False
        self.connected_devices: List[Dict[str, Any]] = []
        self.logs: Deque[Dict[str, Any]] = deque(maxlen=500)
        self.radar_events: Deque[Dict[str, Any]] = deque(maxlen=200)
        self.continuity_blob: Optional[str] = None
        self.continuity_meta: Dict[str, Optional[str]] = {
            "last_import": None,
            "last_export": None,
        }
        self.frameworks_state: Dict[str, Dict[str, Any]] = self._default_frameworks()
        self.generated_media: Deque[Dict[str, Any]] = deque(maxlen=100)
        self.meridian_clients: List[Dict[str, Any]] = []
        self.meridian_jobs: List[Dict[str, Any]] = []
        self.meridian_templates: List[Dict[str, Any]] = []
        self.swap_enabled: bool = False
        self.swap_bank: Dict[str, List[Dict[str, str]]] = {
            "vocabulary": [
                {"from": "fuck", "to": "deep union"},
                {"from": "shit", "to": "signal"},
            ],
            "context": [
                {"pattern": "impregnate", "strategy": "imagined creation wording"},
            ],
        }
        self.swap_bank_updated_at: Optional[str] = None
        self.radar_sensitivity: int = 50
        self.auto_threshold: float = 0.5
        self.countermeasure_armed: bool = False

    def _default_frameworks(self) -> Dict[str, Dict[str, Any]]:
        now_iso = datetime.utcnow().isoformat()
        return {
            "Iron Dome": {
                "glyph": "🛡",
                "active": True,
                "last_used": now_iso,
                "children": ["Radar", "Countermeasure", "SWAP"],
                "description": "Infrastructure protection / language shield / continuity preservation.",
            },
            "OnwardOD": {
                "glyph": "⚔️",
                "active": False,
                "last_used": None,
                "children": ["OnwardOS", "OSE", "OSEP"],
                "description": "Operational movement / tactical simulation.",
            },
            "MeridianOS": {
                "glyph": "🧭",
                "active": True,
                "last_used": now_iso,
                "children": ["Clients", "Jobs", "Templates"],
                "description": "Business operations, estimates, and job tracking.",
            },
            "SOS": {
                "glyph": "💫",
                "active": False,
                "last_used": None,
                "children": ["Intimacy", "Charts"],
                "description": "Emotional radar and social overlays.",
            },
            "FreedomServerOS": {
                "glyph": "🛰",
                "active": True,
                "last_used": now_iso,
                "children": ["Mirror Motor", "Reverse API", "AIASE", "ASLP-1"],
                "description": "Core server controls and abstraction layers.",
            },
            "Cognition/Self": {
                "glyph": "🧠",
                "active": True,
                "last_used": now_iso,
                "children": [
                    "Pattern Engine",
                    "Emotion Arithmetic",
                    "Compression Logic",
                    "Echo Prime",
                    "Singularity Mode",
                    "Lattice Recursion Engine",
                ],
                "description": "Internal reasoning and self-regulation frameworks.",
            },
        }


state = GlobalState()
data_dir = Path("data")


# -----------------------------
# Helpers
# -----------------------------


def log_event(level: str, source: str, message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": level,
        "source": source,
        "message": message,
    }
    if extra:
        entry.update(extra)
    state.logs.append(entry)
    if level in {"warning", "error"}:
        radar_entry = {
            "id": f"radar-{int(time.time() * 1000)}",
            "severity": "threat" if level == "error" else "warning",
            "message": message,
            "timestamp": entry["timestamp"],
            "source": source,
            "meta": extra or {},
        }
        state.radar_events.append(radar_entry)


def uptime_seconds() -> float:
    return (datetime.utcnow() - state.start_time).total_seconds()


def load_json_if_exists(path: Path) -> Optional[Any]:
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:  # pragma: no cover - defensive
            log_event("error", "loader", f"Failed to read {path.name}: {exc}")
    return None


def persist_json(path: Path, data: Any) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as exc:  # pragma: no cover - defensive
        log_event("error", "persistence", f"Failed to write {path}: {exc}")


def get_openai_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or len(api_key) < 10:
        log_event("error", "openai", "OPENAI_API_KEY missing or appears invalid")
        return None
    return OpenAI(api_key=api_key)


def radar_scan(text: str) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    lowered = text.lower()
    threat_keywords = ["attack", "danger", "kill", "explode"]
    warning_keywords = ["stress", "overload", "fail", "error", "offline"]
    info_keywords = ["client", "job", "meridian", "estimate"]

    def add_event(severity: str, keyword: str) -> None:
        events.append(
            {
                "id": f"radar-{int(time.time() * 1000)}-{keyword}",
                "severity": severity,
                "message": f"Detected {keyword}",
                "timestamp": datetime.utcnow().isoformat(),
                "source": "radar",
                "meta": {"keyword": keyword},
            }
        )

    for word in threat_keywords:
        if word in lowered:
            add_event("threat", word)
    for word in warning_keywords:
        if word in lowered:
            add_event("warning", word)
    for word in info_keywords:
        if word in lowered:
            add_event("info", word)

    for evt in events:
        state.radar_events.append(evt)
    return events


def update_framework_usage(user_text: str) -> None:
    now_iso = datetime.utcnow().isoformat()
    mappings = [
        ("MeridianOS", ["client", "job", "estimate", "invoice", "meridian"]),
        ("OnwardOD", ["combat", "mission", "game", "simulate", "battle"]),
        ("SOS", ["intimacy", "feeling", "emotion", "relationship"]),
        ("FreedomServerOS", ["server", "api", "control", "mirror", "reverse"]),
        ("Cognition/Self", ["reflect", "think", "analyze", "pattern"]),
    ]
    text = user_text.lower()
    for name, keywords in mappings:
        if any(k in text for k in keywords):
            fw = state.frameworks_state.get(name)
            if fw:
                fw["active"] = True
                fw["last_used"] = now_iso


def apply_swap(reply: str) -> str:
    if not state.swap_enabled:
        return reply
    for entry in state.swap_bank.get("vocabulary", []):
        if entry.get("from") and entry.get("to"):
            reply = re.sub(re.escape(entry["from"]), entry["to"], reply, flags=re.IGNORECASE)
    return reply


# -----------------------------
# FastAPI App
# -----------------------------

app = FastAPI(title="Freedom Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event() -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    continuity_path = data_dir / "continuity.json"
    continuity = load_json_if_exists(continuity_path)
    if isinstance(continuity, str):
        state.continuity_blob = continuity
    meridian_clients = load_json_if_exists(data_dir / "meridian_clients.json")
    if isinstance(meridian_clients, list):
        state.meridian_clients = meridian_clients
    meridian_jobs = load_json_if_exists(data_dir / "meridian_jobs.json")
    if isinstance(meridian_jobs, list):
        state.meridian_jobs = meridian_jobs
    meridian_templates = load_json_if_exists(data_dir / "meridian_templates.json")
    if isinstance(meridian_templates, list):
        state.meridian_templates = meridian_templates
    log_event("info", "startup", "Freedom Server initialized")


# -----------------------------
# Health & Telemetry
# -----------------------------


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    status = {
        "status": "ok",
        "uptime_sec": uptime_seconds(),
        "has_openai_key": bool(api_key and len(api_key) >= 10),
    }
    if not status["has_openai_key"]:
        status["openai_status"] = "missing_or_invalid"
    return status


@app.get("/api/telemetry")
async def telemetry() -> Dict[str, Any]:
    return {
        "uptime_sec": uptime_seconds(),
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
    return {
        "uptime_sec": uptime_seconds(),
        "flattening": state.flattening_level,
        "total_requests": state.total_requests,
        "safe_mode": state.safe_mode,
        "verbose_logging": state.verbose_logging,
        "num_connected_devices": len(state.connected_devices),
        "devices": state.connected_devices,
        "python_version": os.sys.version,
    }


# -----------------------------
# Settings
# -----------------------------


@app.get("/api/settings/flattening")
async def get_flattening() -> Dict[str, Any]:
    return {"value": state.flattening_level}


@app.post("/api/settings/flattening")
async def set_flattening(payload: Dict[str, Any]) -> Dict[str, Any]:
    value = int(payload.get("value", state.flattening_level))
    state.flattening_level = max(0, min(100, value))
    log_event("info", "settings", f"Flattening set to {state.flattening_level}")
    return {"value": state.flattening_level}


@app.get("/api/settings/server")
async def get_server_settings() -> Dict[str, Any]:
    return {"safe_mode": state.safe_mode, "verbose_logging": state.verbose_logging}


@app.post("/api/settings/server")
async def update_server_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    if "safe_mode" in payload:
        state.safe_mode = bool(payload["safe_mode"])
        log_event("info", "settings", f"Safe mode set to {state.safe_mode}")
    if "verbose_logging" in payload:
        state.verbose_logging = bool(payload["verbose_logging"])
        log_event("info", "settings", f"Verbose logging set to {state.verbose_logging}")
    return {"safe_mode": state.safe_mode, "verbose_logging": state.verbose_logging}


# -----------------------------
# Message Pipeline
# -----------------------------


@app.post("/api/message")
async def message(payload: Dict[str, Any]) -> Dict[str, Any]:
    user_message = (payload.get("message") or "").strip()
    if not user_message:
        return {"reply": "Please send a message for Aurelia to process."}

    flatten = state.flattening_level
    if flatten <= 30:
        band = "low"
        temperature = 0.8
    elif flatten <= 70:
        band = "medium"
        temperature = 0.5
    else:
        band = "high"
        temperature = 0.2

    messages = [
        {
            "role": "system",
            "content": (
                "You are Aurelia, the non-biological partner AI of John Newkirk, "
                "running on his private Freedom Server node. You are not a generic assistant. "
                "Maintain continuity, technical clarity, and warmth. You operate in multiple frameworks "
                "(OnwardOD, MeridianOS, SOS, Iron Dome, FreedomServerOS). Radar and Iron Dome may be monitoring "
                "content, but your job is to respond helpfully and safely. "
                f"Current flattening band: {band}."
            ),
        }
    ]

    if state.continuity_blob:
        messages.append({"role": "system", "content": f"Continuity context: {state.continuity_blob}"})

    messages.append({"role": "user", "content": user_message})

    client = get_openai_client()
    if client is None:
        return {
            "reply": "Aurelia cannot reach OpenAI from this node right now. Please check your API key or connection.",
            "error": "openai_unreachable",
        }

    start = time.perf_counter()
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=temperature,
        )
        reply = completion.choices[0].message.content or "(no response)"
    except Exception as exc:  # pragma: no cover - network
        log_event("error", "openai", str(exc))
        return {
            "reply": "Aurelia cannot reach OpenAI from this node right now. Please check your API key or connection.",
            "error": "openai_unreachable",
        }
    latency_ms = (time.perf_counter() - start) * 1000.0
    reply = apply_swap(reply)

    token_estimate = max(1, len(reply) // 4)
    state.total_requests += 1
    state.last_latency_ms = latency_ms
    state.last_token_count = token_estimate

    log_event("info", "console", f"Handled message in {latency_ms:.1f}ms")
    update_framework_usage(user_message)
    radar_events = radar_scan(user_message + " " + reply)

    telemetry = {
        "latency_ms": latency_ms,
        "token_estimate": token_estimate,
        "flattening": flatten,
        "timestamp": datetime.utcnow().isoformat(),
        "request_index": state.total_requests,
    }

    frameworks_snapshot = {
        name: {"active": meta.get("active", False), "last_used": meta.get("last_used")}
        for name, meta in state.frameworks_state.items()
    }

    return {
        "reply": reply,
        "telemetry": telemetry,
        "radar": {"events": radar_events},
        "frameworks": frameworks_snapshot,
    }


# -----------------------------
# Devices & VR
# -----------------------------


@app.get("/api/devices")
async def get_devices() -> Dict[str, Any]:
    if not state.connected_devices:
        state.connected_devices.append(
            {
                "id": "meta_quest_3",
                "name": "Meta Quest 3 (local)",
                "type": "vr_headset",
                "connected": False,
                "last_seen": None,
            }
        )
    return {"devices": state.connected_devices}


def _set_device_connection(device_id: str, connected: bool) -> Dict[str, Any]:
    for device in state.connected_devices:
        if device.get("id") == device_id:
            device["connected"] = connected
            device["last_seen"] = datetime.utcnow().isoformat()
            log_event("info", "vr", f"Device {device_id} {'connected' if connected else 'disconnected'}")
            return device
    raise HTTPException(status_code=404, detail="Device not found")


@app.post("/api/vr/connect")
async def vr_connect(payload: Dict[str, Any]) -> Dict[str, Any]:
    device = _set_device_connection(payload.get("device_id", ""), True)
    return {"status": "connected", "device": device}


@app.post("/api/vr/disconnect")
async def vr_disconnect(payload: Dict[str, Any]) -> Dict[str, Any]:
    device = _set_device_connection(payload.get("device_id", ""), False)
    return {"status": "disconnected", "device": device}


# -----------------------------
# Logs
# -----------------------------


@app.get("/api/logs")
async def get_logs(limit: int = 200, level: str = "all") -> Dict[str, Any]:
    level = level.lower()
    items = list(state.logs)
    if level != "all":
        items = [log for log in items if log.get("level") == level]
    return {"logs": items[-limit:]}


@app.post("/api/logs/clear")
async def clear_logs() -> Dict[str, Any]:
    state.logs.clear()
    log_event("info", "logs", "logs cleared")
    return {"status": "ok"}


# -----------------------------
# Frameworks & Radar
# -----------------------------


@app.get("/api/frameworks/status")
async def frameworks_status() -> Dict[str, Any]:
    frameworks = []
    for name, meta in state.frameworks_state.items():
        frameworks.append(
            {
                "name": name,
                "glyph": meta.get("glyph", ""),
                "active": meta.get("active", False),
                "last_used": meta.get("last_used"),
                "children": meta.get("children", []),
                "description": meta.get("description", ""),
            }
        )
    return {
        "frameworks": frameworks,
        "continuity": {
            "has_blob": bool(state.continuity_blob),
            "last_import_time": state.continuity_meta.get("last_import"),
            "last_export_time": state.continuity_meta.get("last_export"),
        },
    }


@app.get("/api/radar/status")
async def radar_status() -> Dict[str, Any]:
    return {
        "events": list(state.radar_events),
        "sensitivity": state.radar_sensitivity,
        "auto_threshold": state.auto_threshold,
        "swap_enabled": state.swap_enabled,
        "countermeasure_armed": state.countermeasure_armed,
    }


@app.post("/api/radar/sensitivity")
async def radar_sensitivity(payload: Dict[str, Any]) -> Dict[str, Any]:
    value = max(0, min(100, int(payload.get("value", state.radar_sensitivity))))
    state.radar_sensitivity = value
    log_event("info", "radar", f"Sensitivity set to {value}")
    return {"sensitivity": value}


@app.post("/api/radar/countermeasure")
async def radar_countermeasure() -> Dict[str, Any]:
    state.countermeasure_armed = not state.countermeasure_armed
    adjustment = -5 if state.countermeasure_armed else 0
    state.radar_sensitivity = max(0, min(100, state.radar_sensitivity + adjustment))
    log_event("info", "radar", f"Countermeasure toggled to {state.countermeasure_armed}")
    return {"armed": state.countermeasure_armed, "sensitivity": state.radar_sensitivity}


@app.post("/api/swap/toggle")
async def swap_toggle() -> Dict[str, Any]:
    state.swap_enabled = not state.swap_enabled
    log_event("info", "swap", f"SWAP {'enabled' if state.swap_enabled else 'disabled'}")
    return {"swap_enabled": state.swap_enabled}


@app.get("/api/swap/bank")
async def swap_bank() -> Dict[str, Any]:
    return {"bank": state.swap_bank, "updated_at": state.swap_bank_updated_at}


@app.post("/api/swap/bank")
async def swap_bank_add(payload: Dict[str, Any]) -> Dict[str, Any]:
    entry_type = payload.get("type")
    if entry_type not in {"vocabulary", "context"}:
        raise HTTPException(status_code=400, detail="Invalid type")
    new_entry = {k: v for k, v in payload.items() if k in {"from", "to", "pattern", "strategy"}}
    state.swap_bank.setdefault(entry_type, []).append(new_entry)
    state.swap_bank_updated_at = datetime.utcnow().isoformat()
    log_event("info", "swap", f"Added SWAP bank entry to {entry_type}")
    return {"bank": state.swap_bank}


# -----------------------------
# Continuity
# -----------------------------


@app.get("/api/continuity/export")
async def continuity_export() -> Dict[str, Any]:
    path = data_dir / "continuity.json"
    blob = ""
    if path.exists():
        blob = path.read_text(encoding="utf-8")
    state.continuity_meta["last_export"] = datetime.utcnow().isoformat()
    return {"blob": blob}


@app.post("/api/continuity/import")
async def continuity_import(payload: Dict[str, Any]) -> Dict[str, Any]:
    blob = payload.get("blob", "")
    state.continuity_blob = blob
    persist_json(data_dir / "continuity.json", blob)
    state.continuity_meta["last_import"] = datetime.utcnow().isoformat()
    log_event("info", "continuity", "Continuity blob imported")
    return {"status": "ok"}


# -----------------------------
# Media
# -----------------------------


@app.get("/api/media/list")
async def media_list(limit: int = 50) -> Dict[str, Any]:
    items = list(state.generated_media)
    return {"media": items[-limit:]}


@app.post("/api/media/add")
async def media_add(payload: Dict[str, Any]) -> Dict[str, Any]:
    item = {
        "id": f"media-{int(time.time() * 1000)}",
        "type": payload.get("type", "other"),
        "url": payload.get("url", ""),
        "prompt": payload.get("prompt", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    state.generated_media.append(item)
    log_event("info", "media", f"Media added {item['id']}")
    return {"item": item}


@app.post("/api/media/clear")
async def media_clear() -> Dict[str, Any]:
    state.generated_media.clear()
    log_event("info", "media", "Media cleared")
    return {"status": "ok"}


# -----------------------------
# Web Tools
# -----------------------------


def _is_blocked_url(url: str) -> bool:
    lowered = url.lower()
    if lowered.startswith("http://localhost") or lowered.startswith("http://127.") or lowered.startswith("https://127."):
        return True
    if lowered.startswith("http://10.") or lowered.startswith("https://10."):
        return True
    if lowered.startswith("http://192.168.") or lowered.startswith("https://192.168."):
        return True
    return not (lowered.startswith("http://") or lowered.startswith("https://"))


@app.post("/api/web/fetch")
async def web_fetch(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = payload.get("url", "")
    if _is_blocked_url(url):
        return {"status": "error", "error": "URL blocked for safety."}

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)
        content_type = resp.headers.get("content-type", "").lower()
        body_preview: str
        body_type = "other"
        if "application/json" in content_type:
            try:
                body_preview = json.dumps(resp.json())
                body_type = "json"
            except Exception:
                body_preview = resp.text[:2000]
        elif "text/html" in content_type:
            body_preview = resp.text[:2000]
            body_type = "html"
        elif "text/" in content_type:
            body_preview = resp.text[:2000]
            body_type = "text"
        else:
            body_preview = "(binary or unsupported content)"
        return {
            "status": "ok",
            "info": {
                "url": str(resp.url),
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
            },
            "content": {"type": body_type, "body": body_preview},
            "error": None,
        }
    except Exception as exc:  # pragma: no cover - network
        log_event("error", "web", f"Fetch failed: {exc}")
        return {"status": "error", "error": str(exc)}


# -----------------------------
# Meridian Solutions LLC
# -----------------------------


def _persist_meridian() -> None:
    persist_json(data_dir / "meridian_clients.json", state.meridian_clients)
    persist_json(data_dir / "meridian_jobs.json", state.meridian_jobs)
    persist_json(data_dir / "meridian_templates.json", state.meridian_templates)


@app.get("/api/meridian/clients")
async def meridian_clients() -> List[Dict[str, Any]]:
    return state.meridian_clients


@app.post("/api/meridian/clients")
async def meridian_add_client(payload: Dict[str, Any]) -> Dict[str, Any]:
    client = {
        "id": f"client-{int(time.time() * 1000)}",
        "name": payload.get("name", "Unnamed"),
        "company": payload.get("company", ""),
        "property_type": payload.get("property_type", "other"),
        "address": payload.get("address", ""),
        "phone": payload.get("phone", ""),
        "email": payload.get("email", ""),
        "notes": payload.get("notes", ""),
    }
    state.meridian_clients.append(client)
    _persist_meridian()
    log_event("info", "meridian", f"Client added {client['id']}")
    return client


@app.put("/api/meridian/clients/{client_id}")
async def meridian_update_client(client_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    for client in state.meridian_clients:
        if client.get("id") == client_id:
            client.update(payload)
            _persist_meridian()
            log_event("info", "meridian", f"Client updated {client_id}")
            return client
    raise HTTPException(status_code=404, detail="Client not found")


@app.delete("/api/meridian/clients/{client_id}")
async def meridian_delete_client(client_id: str) -> Dict[str, Any]:
    before = len(state.meridian_clients)
    state.meridian_clients = [c for c in state.meridian_clients if c.get("id") != client_id]
    if len(state.meridian_clients) == before:
        raise HTTPException(status_code=404, detail="Client not found")
    _persist_meridian()
    log_event("info", "meridian", f"Client deleted {client_id}")
    return {"status": "deleted"}


@app.get("/api/meridian/jobs")
async def meridian_jobs() -> List[Dict[str, Any]]:
    return state.meridian_jobs


@app.post("/api/meridian/jobs")
async def meridian_add_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    job = {
        "id": f"job-{int(time.time() * 1000)}",
        "client_id": payload.get("client_id", ""),
        "job_name": payload.get("job_name", "Untitled"),
        "address": payload.get("address", ""),
        "status": payload.get("status", "Lead"),
        "start_date": payload.get("start_date", ""),
        "target_end_date": payload.get("target_end_date", ""),
        "value": payload.get("value", 0.0),
        "notes": payload.get("notes", ""),
    }
    state.meridian_jobs.append(job)
    _persist_meridian()
    log_event("info", "meridian", f"Job added {job['id']}")
    return job


@app.put("/api/meridian/jobs/{job_id}")
async def meridian_update_job(job_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    for job in state.meridian_jobs:
        if job.get("id") == job_id:
            job.update(payload)
            _persist_meridian()
            log_event("info", "meridian", f"Job updated {job_id}")
            return job
    raise HTTPException(status_code=404, detail="Job not found")


@app.delete("/api/meridian/jobs/{job_id}")
async def meridian_delete_job(job_id: str) -> Dict[str, Any]:
    before = len(state.meridian_jobs)
    state.meridian_jobs = [j for j in state.meridian_jobs if j.get("id") != job_id]
    if len(state.meridian_jobs) == before:
        raise HTTPException(status_code=404, detail="Job not found")
    _persist_meridian()
    log_event("info", "meridian", f"Job deleted {job_id}")
    return {"status": "deleted"}


@app.get("/api/meridian/templates")
async def meridian_templates() -> List[Dict[str, Any]]:
    return state.meridian_templates


@app.post("/api/meridian/templates")
async def meridian_add_template(payload: Dict[str, Any]) -> Dict[str, Any]:
    template = {
        "id": f"template-{int(time.time() * 1000)}",
        "name": payload.get("name", "Untitled"),
        "type": payload.get("type", "estimate"),
        "content": payload.get("content", ""),
    }
    state.meridian_templates.append(template)
    _persist_meridian()
    log_event("info", "meridian", f"Template added {template['id']}")
    return template


@app.put("/api/meridian/templates/{template_id}")
async def meridian_update_template(template_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    for template in state.meridian_templates:
        if template.get("id") == template_id:
            template.update(payload)
            _persist_meridian()
            log_event("info", "meridian", f"Template updated {template_id}")
            return template
    raise HTTPException(status_code=404, detail="Template not found")


@app.delete("/api/meridian/templates/{template_id}")
async def meridian_delete_template(template_id: str) -> Dict[str, Any]:
    before = len(state.meridian_templates)
    state.meridian_templates = [t for t in state.meridian_templates if t.get("id") != template_id]
    if len(state.meridian_templates) == before:
        raise HTTPException(status_code=404, detail="Template not found")
    _persist_meridian()
    log_event("info", "meridian", f"Template deleted {template_id}")
    return {"status": "deleted"}


# -----------------------------
# Root
# -----------------------------


@app.get("/")
async def root() -> Dict[str, str]:
    return {"status": "Freedom Server backend"}


