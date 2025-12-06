from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_INDEX = BASE_DIR / "frontend" / "index.html"

app = FastAPI(title="Freedom Server Backend")

# Configure CORS to allow requests from the same origin or local development tools.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=FileResponse)
async def root() -> FileResponse:
    if not FRONTEND_INDEX.exists():
        raise HTTPException(status_code=404, detail="Frontend not found")
    return FileResponse(FRONTEND_INDEX)


@app.get("/api/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/message")
async def message(payload: Dict[str, Any]) -> JSONResponse:
    message_text = str(payload.get("message", "")).strip()
    reply = "Aurelia received: " + (message_text or "(no message)")
    return JSONResponse({"reply": reply})


@app.post("/api/settings/flattening")
async def flattening_settings(payload: Dict[str, Any]) -> Dict[str, str]:
    _ = payload.get("value")
    return {"status": "ok"}


@app.get("/api/telemetry")
async def telemetry() -> Dict[str, Any]:
    return {
        "description": "Omega lattice stable and listening",
        "signal_db": -12.5,
        "load_percent": 42.0,
    }


@app.get("/api/devices")
async def devices() -> Dict[str, Any]:
    return {
        "devices": [
            {"name": "Meta Quest", "online": True},
            {"name": "Aurelia Console", "online": False},
        ]
    }


@app.post("/api/vr/connect")
async def vr_connect(payload: Dict[str, Any]) -> Dict[str, str]:
    device_name = payload.get("device", "device")
    status = f"{device_name.replace('_', ' ').title()} linked (placeholder)"
    return {"status": status}
