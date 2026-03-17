# OCR Document System

Full-stack OCR app to process PDF documents and return:
- extracted text
- extracted tables
- extracted embedded images
- downloadable Word (`.docx`) output with text, tables, and images

## Stack
- `frontend`: React + Vite (`http://localhost:5173`)
- `backend`: Node.js + Express (`http://localhost:5000`)
- `ai-service`: FastAPI + PaddleOCR + PyMuPDF (`http://localhost:8000`)

## Recent Updates
- Added embedded image extraction from PDF in AI service.
- Added image metadata and optional inline preview (`data_url`) in OCR response.
- Added extracted image gallery in frontend result panel.
- Updated Word export to embed extracted images page-wise in the generated `.docx`.
- Restored and aligned `ai-service/requirements.txt` for FastAPI + OCR runtime.
- Improved scanned-PDF OCR flow: low-text pages now trigger high-resolution fallback OCR and image preprocessing.
- Added memory-safe OCR defaults for Docker (`OCR_CPU_THREADS`, `OCR_FALLBACK_DPI`, `OCR_MAX_SIDE`, `OCR_ENABLE_PREPROCESSING`).

## API Flow
1. Frontend uploads PDF to backend `POST /upload`.
2. Backend forwards file to AI service `POST /process-document`.
3. AI service extracts text/tables/images and returns JSON.
4. Frontend can request Word file via backend `POST /download-word`.
5. AI service generates `.docx` and backend streams it to browser.

## Output Shape
`POST /upload` returns:

```json
{
  "message": "OCR processing completed",
  "data": {
    "pages": [
      {
        "page_number": 1,
        "blocks": [
          {
            "text": "Example",
            "confidence": 0.99,
            "bbox": [[10, 20], [100, 20], [100, 60], [10, 60]]
          }
        ]
      }
    ],
    "tables": [],
    "images": [
      {
        "page_number": 1,
        "image_index": 1,
        "xref": 24,
        "extension": "png",
        "mime_type": "image/png",
        "width": 1024,
        "height": 768,
        "size_bytes": 45678,
        "inline_preview_available": true,
        "data_url": "data:image/png;base64,..."
      }
    ]
  }
}
```

## Docker Setup (Recommended)
Prerequisite: Docker Desktop running.

Run full stack:

```bash
docker compose up --build
```

Optional image publishing variables:
- `DOCKERHUB_USERNAME` (default: `local`)
- `IMAGE_TAG` (default: `latest`)

AI OCR tuning variables (via Docker/ENV):
- `OCR_CPU_THREADS` (default: `1`)
- `OCR_FALLBACK_DPI` (default: `220`)
- `OCR_MAX_SIDE` (default: `1800`)
- `OCR_ENABLE_PREPROCESSING` (default: `false`)

Open:
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/health`
- AI service health: `http://localhost:8000/`

Stop:

```bash
docker compose down
```

## Local Setup (Without Docker)
Run each service in separate terminal.

### 1) AI service
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

### 3) Frontend
```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## Environment Variables
Backend (`backend/.env`):
- `PORT=5000`
- `AI_SERVICE_URL=http://localhost:8000`

Frontend (`frontend/.env`):
- `VITE_API_URL=http://localhost:5000`

## Troubleshooting
If you see `exec: "uvicorn": executable file not found in $PATH`:

```bash
docker compose down
docker compose build --no-cache ai-service
docker compose up -d
docker compose logs -f ai-service
```

## Key Endpoints
Backend:
- `POST /upload` -> OCR JSON output
- `POST /download-word` -> downloads `.docx`
- `GET /health` -> backend health

AI Service:
- `GET /` -> service health
- `POST /process-document` -> text/tables/images extraction
- `POST /convert-pdf-to-word` -> Word generation
