from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"
LOG_PATH = DATA_DIR / "logs.json"
IMAGES_DIR = STATIC_DIR / "images"

app = FastAPI(title="LoRa Surveillance API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _load_logs() -> List[dict]:
    if not LOG_PATH.exists():
        return []

    try:
        raw = json.loads(LOG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupt logs.json: {exc}") from exc

    if not isinstance(raw, list):
        raise HTTPException(status_code=500, detail="logs.json should contain a JSON array")

    return raw


def _load_images() -> List[dict]:
    if not IMAGES_DIR.exists():
        return []

    items = []
    for file in IMAGES_DIR.iterdir():
        if file.suffix.lower() not in {".png", ".jpg", ".jpeg", ".gif", ".bmp"}:
            continue
        stat = file.stat()
        ts = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
        items.append(
            {
                "filename": file.name,
                "url": f"/static/images/{file.name}",
                "timestamp": ts.isoformat(),
            }
        )

    items.sort(key=lambda item: item["timestamp"], reverse=True)
    return items


@app.get("/api/status")
async def get_status():
    return {"status": "online", "time": datetime.now(tz=timezone.utc).isoformat()}


@app.get("/api/logs")
async def get_logs():
    events = _load_logs()
    events_sorted = sorted(events, key=lambda e: e.get("timestamp", ""), reverse=True)
    return {"events": events_sorted, "total": len(events_sorted)}


@app.get("/api/images")
async def get_images():
    images = _load_images()
    return {"images": images, "total": len(images)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
