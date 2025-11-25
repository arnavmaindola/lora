# LoRa-Triggered Surveillance Dashboard – Linux Backend Setup

This document explains how to:

- Move the **backend** to a Linux device.
- Wire your **LoRa + IP camera Python script** into the backend folders.
- Connect the **frontend dashboard** (React/Vite) to the backend.
- Understand how **FastAPI** talks to the frontend (and why Flask is not needed).

---

## 1. Architecture Overview

- **Linux device**
  - Runs:
    - LoRa + camera capture script (`capture.py` or similar)
    - FastAPI backend (`backend/`)
  - Stores:
    - Snapshots → `backend/static/images/`
    - Logs → `backend/data/logs.json`

- **Frontend (React/Vite)**
  - Can run on Windows (or any other machine).
  - Talks to Linux backend via HTTP:
    - `GET /api/logs`
    - `GET /api/images`

Data flow:

```text
LoRa sensor → Linux script → images + logs on disk
    ↓
FastAPI reads those files → /api/logs, /api/images
    ↓
Frontend fetches JSON → renders logs + screenshots

The Python script does not call FastAPI directly.
FastAPI just reads what the script writes.
2. Move Backend to Linux

On the Linux device, choose a base directory, e.g.:

mkdir -p ~/lora-dashboard

Copy the backend/ folder from your Windows machine into:

~/lora-dashboard/backend

You should now have:

~/lora-dashboard/backend/
  main.py
  data/
    logs.json  (can start as [])
  static/
    images/    (snapshots will go here)

3. Set Up Backend on Linux

From the Linux terminal:

cd ~/lora-dashboard/backend

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

Run the backend so it is reachable on the network:

uvicorn main:app --host 0.0.0.0 --port 8000

Then, from another device (e.g., your laptop browser):

http://LINUX_IP:8000/api/logs
http://LINUX_IP:8000/api/images

    Replace LINUX_IP with the actual IP address of the Linux device.

    Initially:

        /api/logs will likely return: {"events": [], "total": 0}

        /api/images may be empty until snapshots are saved.

Once this works, the backend is correctly running on Linux.
4. Decide Where Snapshots & Logs Live

The backend expects:

    Snapshots (images) in:

backend/static/images/

Logs JSON in:

    backend/data/logs.json

On Linux (example absolute paths):

/home/youruser/lora-dashboard/backend/static/images
/home/youruser/lora-dashboard/backend/data/logs.json

Your LoRa + camera script must write exactly here so FastAPI can serve them.
5. Updated Python Script (Linux, Integrated with Backend)

This version of the script:

    Saves snapshots into backend/static/images/

    Appends events into backend/data/logs.json

    Keeps your LoRa + IP camera logic

    🔴 Important: change BASE_DIR to match your actual backend path on Linux.

import cv2
import serial
import time
import os
import json
from datetime import datetime
from pathlib import Path

# --- DEBUG LOGGING ---
DEBUG = True

# Use TCP for RTSP to reduce lag
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

# ====== PATH SETUP (EDIT THIS!) ======
# This should be the path to your backend folder on Linux
BASE_DIR = Path("/home/youruser/lora-dashboard/backend")  # <-- CHANGE THIS

IMAGES_DIR = BASE_DIR / "static" / "images"
LOGS_PATH = BASE_DIR / "data" / "logs.json"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
LOGS_PATH.parent.mkdir(parents=True, exist_ok=True)
if not LOGS_PATH.exists():
    LOGS_PATH.write_text("[]", encoding="utf-8")

# ====== SERIAL + CAMERA CONFIG ======
SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 115200

CAMERA_URL = "rtsp://admin:admin123@10.45.0.199:554/avstream/channel=1/stream=0.sdp"

print("🔌 Opening serial port...")
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)

cap = cv2.VideoCapture(CAMERA_URL)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # reduce lag

camera_active = False
window_open = False
frame_counter = 0
last_trigger_time = 0
CAMERA_TIMEOUT = 10  # seconds


def append_event(sensor_id: str, event_type: str, status: str, image_filename: str | None = None):
    """Append a single event to logs.json in a safe way."""
    try:
        if LOGS_PATH.exists():
            with LOGS_PATH.open("r", encoding="utf-8") as f:
                try:
                    events = json.load(f)
                except json.JSONDecodeError:
                    events = []
        else:
            events = []
    except Exception as e:
        print(f"⚠️ Failed to read logs.json: {e}")
        events = []

    events.append({
        "timestamp": datetime.utcnow().isoformat(),
        "sensor_id": sensor_id,
        "event": event_type,
        "status": status,
        "image": image_filename,
    })

    try:
        with LOGS_PATH.open("w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)
        if DEBUG:
            print(f"📝 Logged event ({status}) with image={image_filename}")
    except Exception as e:
        print(f"⚠️ Failed to write logs.json: {e}")


def save_snapshot(frame) -> str | None:
    """Save a snapshot to IMAGES_DIR and return the filename."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"event_{timestamp}.jpg"
    filepath = IMAGES_DIR / filename

    ok = cv2.imwrite(str(filepath), frame)
    if ok:
        print(f"📸 Snapshot saved: {filepath}")
        # If your Linux device is headless, you may want to comment out the imshow below
        cv2.imshow("Snapshot", frame)
        cv2.resizeWindow("Snapshot", 400, 300)
        cv2.waitKey(1)
        return filename
    else:
        print("❌ Snapshot save FAILED")
        return None


print("\n📡 Waiting for LoRa packets...\n")

try:
    while True:

        line = ser.readline().decode(errors='ignore').strip()
        if line:
            print(f"[SERIAL] {line}")

        if line.startswith("Received: "):
            payload = line.replace("Received: ", "").strip()
            print("📥 Trigger:", payload)

            # Basic trigger condition (you can refine this logic)
            if payload == "dhwaj 1" or "IR" in payload or "MOTION" in payload:
                last_trigger_time = time.time()
                camera_active = True
                frame_counter = 0
                print("🎥 Camera ON due to EVENT")

        if camera_active:
            ret, frame = cap.read()
            if not ret:
                print("⚠️ Frame fail → reconnecting...")
                cap.release()
                time.sleep(0.3)
                cap = cv2.VideoCapture(CAMERA_URL)
                continue

            if not window_open:
                cv2.namedWindow("Live", cv2.WINDOW_NORMAL)
                cv2.resizeWindow("Live", 1280, 720)
                window_open = True

            cv2.imshow("Live", frame)
            frame_counter += 1

            # Take snapshot after 3rd valid frame after trigger
            if frame_counter == 3:
                filename = save_snapshot(frame)
                if filename:
                    # Log the event when snapshot is saved
                    append_event(
                        sensor_id="LoRa-Node-01",   # or extract from payload if available
                        event_type=payload if line else "motion",
                        status="triggered",
                        image_filename=filename
                    )

            if time.time() - last_trigger_time > CAMERA_TIMEOUT:
                print("⏱️ Timeout - Camera OFF")
                cv2.destroyWindow("Live")
                window_open = False
                camera_active = False

            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("🛑 Manual stop")
                cv2.destroyWindow("Live")
                window_open = False
                camera_active = False

except KeyboardInterrupt:
    print("🛑 Stopped manually")

finally:
    cap.release()
    ser.close()
    cv2.destroyAllWindows()
    print("🔚 Shutdown complete")

    ⚠️ Remember to update:

    BASE_DIR = Path("/home/youruser/lora-dashboard/backend")

    with your actual Linux username and path.

6. Configure Frontend to Talk to Linux Backend

On the machine where the frontend (React/Vite) runs (e.g., your Windows laptop):

    Find where VITE_API_BASE_URL is defined (in .env or inside the code).

    Set it to the Linux backend URL, for example:

VITE_API_BASE_URL=http://LINUX_IP:8000

    Restart the frontend dev server:

npm run dev

    Open the dashboard (typically):

http://localhost:5173

Now the dashboard will call the Linux backend instead of localhost:8000 on Windows.
7. Test the Full Flow

    On Linux – Backend:

cd ~/lora-dashboard/backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000

On Linux – LoRa + camera script:

    python3 ~/lora-dashboard/capture.py

    On Windows (or any device) – Frontend Dashboard:

        Run npm run dev in frontend/ if needed.

        Open http://localhost:5173 in the browser.

    Trigger an event (PIR / LoRa packet).

You should see:

    A new .jpg created under:

backend/static/images/

A new log entry added to:

    backend/data/logs.json

    The dashboard updating within a few seconds:

        New log row

        New screenshot card in the gallery

At that point, you have a proper integrated LoRa + camera + FastAPI + web UI system.
8. About Flask vs FastAPI

    The original idea was FastAPI + Flask.

    The actual generated backend is a pure FastAPI app that:

        Serves JSON at /api/logs and /api/images

        Serves static files via:

        app.mount("/static", StaticFiles(directory="static"), name="static")

    This is completely fine:

        No Flask is used in practice.

        FastAPI is handling both JSON APIs and static image serving.

The frontend connects to the backend purely via HTTP:

const res = await fetch(`${API_BASE_URL}/api/logs`);
const logs = await res.json();

and

const res = await fetch(`${API_BASE_URL}/api/images`);
const images = await res.json();

No direct Python imports between frontend and backend.
