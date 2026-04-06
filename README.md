# TextTrack AI

TextTrack AI is a Docker-based OCR document intelligence platform built with React, Node.js, FastAPI, PaddleOCR, and PostgreSQL. It processes scanned and digital PDFs, returns structured OCR JSON, supports AI chat on extracted content, exports Word and Excel files, and keeps reusable document history.

## Current Workflow

1. Sign in or register from the frontend.
2. Upload a PDF from the dashboard.
3. The backend sends the file to the FastAPI OCR service.
4. The AI service extracts:
   - page text
   - text blocks
   - detected tables
   - embedded images
   - page metadata
5. The frontend shows OCR output, extracted images, and export actions.
6. Users can:
   - talk with AI about the uploaded document
   - download Word
   - download Excel
   - reopen past work from History

## Services

### Frontend
- Stack: React 19, Vite, React Router, Axios
- Runs on `http://localhost:5173`
- Main responsibilities:
  - authentication screens
  - PDF upload
  - OCR result viewer
  - AI chat UI
  - file-based history cards

### Backend
- Stack: Node.js, Express, Sequelize, PostgreSQL, Gemini SDK
- Runs on `http://localhost:5000`
- Main responsibilities:
  - auth and JWT verification
  - forwarding OCR/Word work to FastAPI
  - Excel generation
  - Gemini-based document assistant
  - activity and history session storage

### AI Service
- Stack: FastAPI, PaddleOCR, PyMuPDF, Camelot, python-docx
- Runs on `http://localhost:8000`
- Main responsibilities:
  - OCR for digital and scanned PDFs
  - page rendering for image-based PDFs
  - table extraction
  - embedded image extraction
  - Word document generation

### Database
- Stack: PostgreSQL 16
- Runs on `localhost:5432`
- Stores:
  - users
  - sessions
  - activities

## Service Connections

- `frontend` calls `backend`
- `backend` calls `ai-service`
- `backend` uses `postgres`
- `docker-compose.yml` wires all services together on one Docker network

## Main API Surface

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `GET /api/auth/profile`
- `GET /api/auth/verify`

### OCR and File Conversion
- `POST /upload`
- `POST /download-word`

### AI Assistant
- `POST /api/ai/chat`
- `POST /api/ai/export-excel`

### History
- `GET /api/activities`
- `GET /api/activities/:id`
- `POST /api/activities/:id/download-word`
- `DELETE /api/activities/:id`

### AI Service
- `GET /`
- `POST /process-document`
- `POST /convert-pdf-to-word`

## Structured OCR Response

The OCR pipeline returns structured JSON like this:

```json
{
  "pages": [
    {
      "page_number": 1,
      "text": "Extracted text...",
      "blocks": [
        {
          "text": "Block content"
        }
      ],
      "tables": [],
      "metadata": {}
    }
  ],
  "tables": [],
  "images": []
}
```

## Running With Docker

1. Make sure Docker Desktop is running.
2. Create `backend/.env` from `backend/.env.example`.
3. Start the stack:

```bash
docker compose up --build
```

4. Open:
   - frontend: `http://localhost:5173`
   - backend health: `http://localhost:5000/health`
   - ai-service health: `http://localhost:8000/`

## Important Environment Variables

Set these in `backend/.env`:

```env
PORT=5000
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=24h
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ocr_system
DB_USER=postgres
DB_PASSWORD=postgres
DB_DIALECT=postgres
AI_SERVICE_URL=http://ai-service:8000
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
JSON_BODY_LIMIT=20mb
```

## Project Documents

- Frontend guide: [frontend/README.md](./frontend/README.md)
- Backend guide: [backend/README.md](./backend/README.md)
- AI service guide: [ai-service/README.md](./ai-service/README.md)

## Recent Capabilities Added

- scanned PDF OCR fallback
- structured page JSON
- Excel export
- AI chat on OCR data
- history-based session restore
- history-based Word re-download
- file-grouped history cards
