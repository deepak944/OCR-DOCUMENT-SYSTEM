# OCR Document System

Full-stack OCR app with authentication and user management to process PDF documents and return:
- extracted text
- extracted tables
- extracted embedded images
- downloadable Word (`.docx`) output with text, tables, and images

## Stack
- `frontend`: React + Vite + React Router (`http://localhost:5173`)
- `backend`: Node.js + Express + JWT + bcrypt (`http://localhost:5000`)
- `ai-service`: FastAPI + PaddleOCR + PyMuPDF (`http://localhost:8000`)

## Features

### Authentication & User Management
- User registration and login with JWT authentication
- Secure password hashing (bcrypt, 10 rounds)
- Protected routes requiring authentication
- 24-hour session management
- User activity tracking and history
- Register redirects to login page (no auto-login)

### OCR Processing
- Native text extraction from digital PDFs
- Scanned PDF support via PaddleOCR fallback
- Embedded image extraction
- Table extraction
- Word (.docx) export with text, tables, and images
- SHA-256 file hash cache (skips re-processing identical files)
- Memory-safe mobile OCR model by default

## API Flow
1. User registers → redirected to login page
2. User logs in → receives JWT token
3. Frontend uploads PDF to `POST /upload` (with auth token)
4. Backend verifies token and forwards to AI service `POST /process-document`
5. AI service extracts text/tables/images and returns JSON
6. Backend tracks user activity
7. Frontend requests Word file via `POST /download-word` (with auth token)
8. User views activity history at `/history`

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

```bash
docker compose up --build
```

Open:
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/health`
- AI service health: `http://localhost:8000/`

Stop:

```bash
docker compose down
```

### Docker healthcheck
The backend waits for the AI service to pass its healthcheck before starting. This prevents `socket hang up` errors on cold boot. The AI service has a 120-second start period to allow model loading.

### Memory
The AI service is limited to `3g` RAM. It uses the mobile OCR detection model (`PP-OCRv5_mobile_det`) and disables heavy pipeline steps (document orientation classifier, unwarping) to stay within limits.

## Local Setup (Without Docker)

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
```
PORT=5000
AI_SERVICE_URL=http://localhost:8000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

Frontend (`frontend/.env`):
```
VITE_API_URL=http://localhost:5000
```

AI service (via Docker env or shell):
```
OCR_CPU_THREADS=2
OCR_FALLBACK_DPI=200
OCR_MAX_SIDE=1600
OCR_ENABLE_PREPROCESSING=false
OCR_DET_MODEL=PP-OCRv5_mobile_det
```

## Key Endpoints

### Authentication
```
POST   /api/auth/register      Register new user (returns user, no token)
POST   /api/auth/login         Login and get JWT token
POST   /api/auth/logout        Logout (requires auth)
GET    /api/auth/profile       Get user profile (requires auth)
GET    /api/auth/verify        Verify token validity (requires auth)
```

### Activities
```
GET    /api/activities         Get user activity history (requires auth)
DELETE /api/activities/:id     Delete a specific activity (requires auth)
```

### Documents (Protected)
```
POST   /upload                 OCR JSON output (requires auth)
POST   /download-word          Downloads .docx (requires auth)
GET    /health                 Backend health check
```

### AI Service
```
GET    /                       Service health
POST   /process-document       Text/tables/images extraction
POST   /convert-pdf-to-word    Word generation
```

## Troubleshooting

### AI service exits with code 137 (OOM)
Increase Docker Desktop memory limit to at least 4 GB. The `mem_limit: 3g` in docker-compose.yml requires Docker Desktop to have enough headroom.

### TLS handshake timeout during build
This is a Docker Desktop network issue, not a code issue.
1. Restart Docker Desktop
2. Run `docker pull node:20-alpine` manually
3. Set DNS to `8.8.8.8` / `1.1.1.1` in Docker Engine settings

### socket hang up / ECONNREFUSED
The backend retries AI service requests with exponential backoff (3 retries, 2s base). If it still fails, check `docker compose logs ai-service` — the service may still be loading models.

### uvicorn not found
```bash
docker compose down
docker compose build --no-cache ai-service
docker compose up -d
```
