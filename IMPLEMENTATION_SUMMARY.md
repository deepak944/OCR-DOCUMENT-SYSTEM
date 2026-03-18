# Implementation Summary

## Current State

Full-stack OCR document processing system with JWT authentication, activity tracking, and memory-safe PaddleOCR integration.

## Services

| Service | Tech | Port |
|---------|------|------|
| Frontend | React + Vite + React Router | 5173 |
| Backend | Node.js + Express + JWT | 5000 |
| AI Service | FastAPI + PaddleOCR + PyMuPDF | 8000 |

## Features Implemented

### Authentication
- User registration — returns user object only (no token), frontend redirects to `/login`
- Login — returns JWT token (24h expiry)
- Logout — blacklists token server-side
- Protected routes via `ProtectedRoute` component
- `Login.jsx` shows success banner when arriving from registration

### Activity Tracking
- Every OCR process and Word export is tracked per user
- `GET /api/activities` — paginated history
- `DELETE /api/activities/:id` — user-scoped delete

### OCR Pipeline
- Native text extraction via PyMuPDF
- Scanned PDF fallback via PaddleOCR (triggers when page has < 12 words or < 60 alnum chars)
- Optional preprocessing: grayscale → denoise → Otsu threshold → deskew
- SHA-256 file hash cache (50-entry FIFO) — identical files skip re-processing
- OCR and Word export run in `run_in_threadpool` (keeps FastAPI event loop free)

### Memory Safety
- Mobile detection model (`PP-OCRv5_mobile_det`) instead of server model
- Heavy pipeline steps disabled (`use_doc_orientation_classify=False`, `use_doc_unwarping=False`)
- `mem_limit: 3g` on AI service container
- `gc.collect()` + page image deletion after each page OCR
- Fallback init if PaddleOCR version doesn't support new kwargs

### Reliability
- AI service healthcheck with 120s start period
- Backend waits for `condition: service_healthy` before starting
- `withRetry()` in `aiService.js` — exponential backoff (3 retries, 2s base) for transient errors

## File Changes by Task

### Scanned PDF OCR (Task 1)
- `ai-service/app/config.py` — raised defaults, added `OCR_DET_MODEL`
- `ai-service/app/ocr/ocr_engine.py` — Otsu threshold, deskew, sparse text detection
- `ai-service/app/services/document_services.py` — `_prefer_ocr_blocks` threshold

### Docker Dependencies (Task 2)
- `backend/package.json` — added `bcryptjs`, `jsonwebtoken`, `form-data`
- `frontend/package.json` — added `react-router-dom`
- `backend/Dockerfile`, `frontend/Dockerfile` — `npm install` instead of `npm ci`

### Feature Implementation (Task 3)
- `backend/src/models/Activity.js` — added `deleteById`
- `backend/src/controllers/activityController.js` — added `deleteActivity`
- `backend/src/routes/activityRoutes.js` — added `DELETE /:id`
- `backend/src/controllers/authController.js` — register returns no token
- `ai-service/app/main.py` — `run_in_threadpool`, SHA-256 cache
- `frontend/src/context/AuthContext.jsx` — register no longer stores token
- `frontend/src/pages/Register.jsx` — redirects to `/login` with `state.registered`
- `frontend/src/pages/Login.jsx` — shows `.auth-info` banner on `state.registered`
- `frontend/src/components/Navbar.jsx` — Dashboard + History nav links
- `frontend/src/pages/History.jsx` — per-record delete with loading state
- `frontend/src/pages/Upload.jsx` — wired up with UploadBox + ResultBox
- `frontend/src/services/api.js` — added `deleteActivity(id)`
- `frontend/src/styles/main.css` — added `.navbar-nav-link`, `.activity-header-right`, `.delete-activity-btn`

### OOM / Socket Hang Up Fix (Task 4)
- `docker-compose.yml` — healthcheck, `condition: service_healthy`, `mem_limit: 3g`, mobile model env
- `ai-service/app/ocr/ocr_engine.py` — disabled heavy pipeline steps, fallback init
- `ai-service/app/services/document_services.py` — `gc.collect()` + page image cleanup
- `backend/src/services/aiService.js` — `withRetry()` with exponential backoff

## API Endpoints

```
POST   /api/auth/register      Register (no token returned)
POST   /api/auth/login         Login → JWT token
POST   /api/auth/logout        Logout (blacklists token)
GET    /api/auth/profile       User profile
GET    /api/auth/verify        Token validity check

GET    /api/activities         Activity history
DELETE /api/activities/:id     Delete activity

POST   /upload                 OCR processing (auth required)
POST   /download-word          Word export (auth required)
GET    /health                 Backend health

GET    /                       AI service health
POST   /process-document       OCR extraction
POST   /convert-pdf-to-word    Word generation
```

## In-Memory Storage

Data resets on container restart. See `DATABASE_MIGRATION_GUIDE.md` for PostgreSQL/MySQL migration.

## Design Policy

The existing frontend visual design (colors, fonts, layout, component structure) is preserved exactly. Only logic, functionality, and minimal additive CSS classes were added.
