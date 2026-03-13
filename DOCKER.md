# Docker Setup

This project is containerized with `docker-compose` and runs as 3 services:

- `frontend` (Vite React app on `5173`)
- `backend` (Node/Express API on `5000`)
- `ai-service` (FastAPI OCR service on `8000`)

## Architecture

```text
Browser
  -> frontend (http://localhost:5173)
  -> backend  (http://localhost:5000)
  -> ai-service (internal: http://ai-service:8000)
```

### Service communication

- Frontend calls backend using `VITE_API_URL` (set to `http://localhost:5000` in compose).
- Backend calls AI service using `AI_SERVICE_URL=http://ai-service:8000`.
- AI service performs OCR/table extraction and returns structured JSON or Word output.

## Run

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/health`
- AI service health: `http://localhost:8000/`

## Stop

```bash
docker compose down
```

## Notes

- A named volume `paddlex-cache` is used to cache Paddle/PaddleX models:
  - Container path: `/root/.paddlex`
- Temporary upload/image folders are created and cleaned by app logic.
