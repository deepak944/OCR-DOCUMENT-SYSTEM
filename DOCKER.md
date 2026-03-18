# Docker Setup

Three services:
- `frontend` — Vite React app on port `5173`
- `backend` — Node/Express API on port `5000`
- `ai-service` — FastAPI OCR service on port `8000`

## Run Locally

```bash
docker compose up --build
```

Open:
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/health`
- AI health: `http://localhost:8000/`

Stop:
```bash
docker compose down
```

## Healthcheck & Startup Order

The AI service exposes a healthcheck (`GET /`) with:
- `interval: 30s`
- `timeout: 20s`
- `retries: 5`
- `start_period: 120s` (allows time for model loading)

The backend uses `condition: service_healthy` so it won't start until the AI service is ready. This prevents `socket hang up` and `ECONNREFUSED` errors on cold boot.

## Memory Limits

The AI service is capped at `3g` RAM (`mem_limit: 3g`, `memswap_limit: 3g`). Docker Desktop must have at least **4 GB** allocated.

If the container exits with code `137` (OOM kill):
1. Open Docker Desktop → Settings → Resources → increase Memory to 4–6 GB
2. Ensure `OCR_DET_MODEL=PP-OCRv5_mobile_det` is set (lighter model)
3. Keep `OCR_ENABLE_PREPROCESSING=false` to reduce peak memory

## OCR Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `OCR_CPU_THREADS` | 2 | PaddleOCR CPU threads |
| `OCR_FALLBACK_DPI` | 200 | DPI for rendering scanned pages |
| `OCR_MAX_SIDE` | 1600 | Max image side before downscale |
| `OCR_ENABLE_PREPROCESSING` | false | Grayscale/denoise/Otsu/deskew pass |
| `OCR_DET_MODEL` | PP-OCRv5_mobile_det | Detection model name |
| `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK` | True | Skip connectivity check on startup |

The mobile detection model and disabled pipeline steps (document orientation classifier, unwarping) significantly reduce RAM usage compared to the server model defaults.

## Push Images to Docker Hub

```powershell
$env:DOCKERHUB_USERNAME="your-dockerhub-username"
$env:IMAGE_TAG="v1.0.0"
docker login
docker compose build
docker compose push
```

## Deploy from Docker Hub

On another machine:
```powershell
$env:DOCKERHUB_USERNAME="your-dockerhub-username"
$env:IMAGE_TAG="v1.0.0"
docker compose pull
docker compose up -d
```

## Scanned PDF Validation

Test a scanned PDF directly against the AI service:
```powershell
curl -X POST "http://localhost:8000/process-document" `
  -H "accept: application/json" `
  -F "file=@C:/path/to/scanned.pdf"
```

Check `pages[*].blocks` in the response for recognized text. If blocks are empty, try a cleaner scan (300+ DPI, non-blurry, non-rotated).

## Common Fixes

### uvicorn not found
```bash
docker compose down
docker compose build --no-cache ai-service
docker compose up -d
docker compose logs -f ai-service
```

### TLS handshake timeout (node:20-alpine)
This is a Docker Desktop network issue:
1. Restart Docker Desktop
2. Run `docker pull node:20-alpine` manually
3. Set DNS to `8.8.8.8` / `1.1.1.1` in Docker Engine JSON settings
4. Retry `docker compose up --build`

### Exit code 137 (OOM)
1. Increase Docker Desktop memory to 4+ GB
2. Verify `OCR_DET_MODEL=PP-OCRv5_mobile_det` in docker-compose.yml
3. Set `OCR_ENABLE_PREPROCESSING=false`
4. Rebuild: `docker compose up --build`

## Notes
- Named volume `paddlex-cache` caches PaddleX models at `/root/.paddlex` across restarts.
- Temporary upload/image folders are cleaned after each request.
- Both `backend` and `frontend` Dockerfiles use `npm install` (not `npm ci`) to handle dependency changes without lockfile conflicts.
