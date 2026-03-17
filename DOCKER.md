# Docker Setup

This project runs 3 services:
- `frontend` (Vite React app on `5173`)
- `backend` (Node/Express API on `5000`)
- `ai-service` (FastAPI OCR service on `8000`)

## 1) Run Locally With Docker Compose

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

## 2) Push Images To Docker Hub

`docker-compose.yml` is configured with image tags:
- `${DOCKERHUB_USERNAME}/ocr-ai-service:${IMAGE_TAG}`
- `${DOCKERHUB_USERNAME}/ocr-backend:${IMAGE_TAG}`
- `${DOCKERHUB_USERNAME}/ocr-frontend:${IMAGE_TAG}`

PowerShell example:

```powershell
$env:DOCKERHUB_USERNAME="your-dockerhub-username"
$env:IMAGE_TAG="v1.0.0"
docker login
docker compose build
docker compose push
```

## 3) Deploy From Docker Hub Images

On another machine/server:

```powershell
$env:DOCKERHUB_USERNAME="your-dockerhub-username"
$env:IMAGE_TAG="v1.0.0"
docker compose pull
docker compose up -d
```

## 4) Scanned PDF Extraction (How To Make It Work)

The OCR pipeline now does this automatically:
1. Extract native text from PDF.
2. If a page has low/weak native text, render it as fallback image (`OCR_FALLBACK_DPI`, default `220`).
3. Downscale oversized images before OCR (`OCR_MAX_SIDE`, default `1800`) to reduce container memory pressure.
4. Run PaddleOCR in compatibility mode (works whether `cls` arg is supported or not).
5. Optional preprocessing OCR pass can be enabled with `OCR_ENABLE_PREPROCESSING=true`.

To validate with a scanned file:

```powershell
curl -X POST "http://localhost:8000/process-document" `
  -H "accept: application/json" `
  -F "file=@C:/path/to/scanned.pdf"
```

Check response:
- `pages[*].blocks` should contain recognized text lines.
- If a page still has empty blocks, test with clearer scan (>=300 DPI, non-blurry, non-rotated).

Memory-safe defaults in `docker-compose.yml`:
- `OCR_CPU_THREADS=1`
- `OCR_FALLBACK_DPI=220`
- `OCR_MAX_SIDE=1800`
- `OCR_ENABLE_PREPROCESSING=false`

## Common Fixes
If AI service fails with `uvicorn` not found:

```bash
docker compose down
docker compose build --no-cache ai-service
docker compose up -d
docker compose logs -f ai-service
```

If `ocr-ai-service` exits with code `137`:
```bash
docker compose down
docker compose up --build -d
docker compose logs -f ai-service
```

Then increase Docker Desktop memory limit (recommended at least `6 GB`) and keep:
- `OCR_CPU_THREADS=1`
- `OCR_ENABLE_PREPROCESSING=false`

## Notes
- Named volume `paddlex-cache` caches Paddle/PaddleX models at `/root/.paddlex`.
- Temporary upload/image folders are cleaned after each request.
