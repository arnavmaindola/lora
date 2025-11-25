# LoRa Surveillance Dashboard

A minimal FastAPI + React/Tailwind dashboard for viewing LoRa-triggered surveillance logs and camera screenshots.

## Suggested Folder Structure

```
lora-dashboard/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ data/
â”‚   â”‚   â””â”€â”€ logs.json          # Sample log data source (append here in production)
â”‚   â”œâ”€â”€ static/
â”‚   â”‚   â””â”€â”€ images/            # Screenshot files served over /static/images
â”‚   â”œâ”€â”€ main.py                # FastAPI app exposing REST endpoints and static files
â”‚   â””â”€â”€ requirements.txt       # Python dependencies
â””â”€â”€ frontend/
    â”œâ”€â”€ index.html             # Vite entry
    â”œâ”€â”€ package.json           # React/Tailwind dependencies
    â”œâ”€â”€ postcss.config.js
    â”œâ”€â”€ tailwind.config.js
    â”œâ”€â”€ vite.config.js
    â””â”€â”€ src/
        â”œâ”€â”€ App.jsx            # Single-page dashboard UI
        â”œâ”€â”€ index.css          # Tailwind pipeline + global styles
        â””â”€â”€ main.jsx           # React bootstrap
```

## Backend (FastAPI)

1. Install dependencies (ideally in a virtual environment):
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate    # PowerShell: .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
2. Start the API and static file server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   - `GET /api/status` â†’ quick health check for the frontend.
   - `GET /api/logs` â†’ reads `data/logs.json` and returns `{ events, total }`.
   - `GET /api/images` â†’ lists files under `static/images` with URLs + timestamps.
   - `/static/images/<filename>` â†’ serves the actual screenshot files.

## Frontend (React + Tailwind)

1. Install node dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Run the Vite dev server:
   ```bash
   npm run dev
   ```
   The dashboard expects the backend at `http://localhost:8000` by default. Override via:
   ```bash
   VITE_API_BASE_URL=http://192.168.1.50:8000 npm run dev
   ```

## Data Flow Expectations

- The LoRa receiver/camera script should append JSON objects to `backend/data/logs.json` and drop screenshots into `backend/static/images` with unique filenames.
- The backend only reads from these files, so no DB setup is required for now.
- The frontend polls the API every 5 seconds, shows log counts, renders a table, and displays screenshot thumbnails with a modal preview.

## Next Steps

- Replace the sample JSON/images with real data produced by your capture script.
- Consider moving from file-based storage to SQLite or another database once persistence requirements grow.
- Lock down CORS/hosts and add authentication if deploying beyond a local network.
