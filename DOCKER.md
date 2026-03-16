# Docker Setup

This project runs as 3 containers:
- `frontend` (Vite React app on `5173`)
- `backend` (Node/Express API on `5000`)
- `ai-service` (FastAPI OCR service on `8000`)

## Current Output Features
- OCR text extraction
- table extraction
- embedded image extraction
- Word export with text, tables, and embedded images

## Run

```bash
docker compose up --build
```

Open:
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/health`
- AI health: `http://localhost:8000/`

## Stop

```bash
docker compose down
```

## Common Fixes
If AI service fails with `uvicorn` not found:

```bash
docker compose down
docker compose build --no-cache ai-service
docker compose up -d
docker compose logs -f ai-service
```

## Notes
- A named volume `paddlex-cache` is used to cache Paddle/PaddleX models at `/root/.paddlex`.
- App logic cleans temporary upload/image folders after request completion.
