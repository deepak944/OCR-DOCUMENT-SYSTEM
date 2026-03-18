# System Architecture

## Overview

Three-service Docker stack for OCR document processing with JWT authentication.

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│                    React + Vite (port 5173)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (JWT Token in Authorization header)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Backend (port 5000)                        │
│                  Node.js + Express + JWT                      │
│                                                               │
│  Auth middleware → verify JWT → check token blacklist         │
│  Document controller → forward to AI service                  │
│  Activity controller → track user actions                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (internal Docker network)
                         │ (backend waits for ai-service healthcheck)
┌────────────────────────▼────────────────────────────────────┐
│                  AI Service (port 8000)                       │
│               FastAPI + PaddleOCR + PyMuPDF                   │
│                                                               │
│  /process-document → OCR pipeline → JSON response            │
│  /convert-pdf-to-word → Word export → file download          │
└─────────────────────────────────────────────────────────────┘
```

## Docker Compose Dependency Chain

```
ai-service (healthcheck: GET /)
    ↓ condition: service_healthy
backend
    ↓ depends_on (simple)
frontend
```

The backend only starts after the AI service passes its healthcheck. This prevents `socket hang up` errors during cold boot when models are still loading (up to 120s start period).

## Service Details

### Frontend (`frontend/`)
- React 18 + Vite + React Router v6
- Auth state managed via `AuthContext` (localStorage JWT)
- Protected routes via `ProtectedRoute` component
- Communicates only with backend (never directly with AI service)

### Backend (`backend/`)
- Node.js + Express
- In-memory user/session/activity stores (ready for DB migration)
- JWT auth with 24-hour expiry and token blacklist on logout
- Forwards PDF uploads to AI service via `aiService.js` with retry logic
- Tracks user activity (OCR process, Word export) per request

### AI Service (`ai-service/`)
- FastAPI + Uvicorn
- PaddleOCR for scanned PDF text extraction
- PyMuPDF (fitz) for native text and image extraction
- SHA-256 file hash cache (50-entry FIFO) to skip re-processing identical files
- OCR and Word export run in `run_in_threadpool` to keep event loop free
- Memory-safe: mobile detection model, heavy pipeline steps disabled

## Authentication Flow

```
Register → POST /api/auth/register
         ← { message, user }   (no token)
         → redirect to /login

Login    → POST /api/auth/login
         ← { user, token }
         → store token in localStorage

Protected request → Authorization: Bearer <token>
                  → authMiddleware verifies JWT
                  → checks token blacklist (Session store)
                  → attaches req.user

Logout   → POST /api/auth/logout
         → token added to blacklist
         → localStorage cleared
```

## OCR Pipeline

```
PDF upload
    ↓
extract_pdf_text_blocks()   ← PyMuPDF native text
    ↓
For each page:
  if native text < 12 words OR < 60 alnum chars:
    render page as PNG (OCR_FALLBACK_DPI, default 200)
    optionally preprocess (grayscale → denoise → Otsu → deskew)
    run PaddleOCR
    pick best result by alnum char count
    ↓
    gc.collect() + delete page image (memory management)
    ↓
extract tables (table_parser.py)
extract embedded images (pdf_processor.py)
    ↓
return { pages, tables, images }
```

## File Structure

```
ocr-document-system/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Navbar.jsx          nav links (Dashboard, History)
│       │   ├── ProtectedRoute.jsx  redirect to /login if not authed
│       │   ├── UploadBox.jsx       file upload UI
│       │   ├── ResultBox.jsx       OCR result display + Word download
│       │   └── Loader.jsx          loading indicator
│       ├── context/
│       │   └── AuthContext.jsx     auth state, register/login/logout
│       ├── pages/
│       │   ├── Home.jsx            OCR extractor
│       │   ├── Upload.jsx          upload page (same as Home)
│       │   ├── History.jsx         activity list with delete
│       │   ├── Login.jsx           login form + post-register banner
│       │   ├── Register.jsx        registration form
│       │   └── ForgotPassword.jsx  UI placeholder
│       └── services/
│           ├── api.js              axios client + auth interceptor
│           └── auth.js             auth API calls
│
├── backend/
│   └── src/
│       ├── controllers/
│       │   ├── authController.js   register (no token), login, logout, profile
│       │   ├── activityController.js  getUserActivities, deleteActivity
│       │   └── documentController.js  upload, download-word
│       ├── middleware/
│       │   ├── authMiddleware.js   JWT verification
│       │   └── uploadMiddleware.js multer file upload
│       ├── models/
│       │   ├── User.js             in-memory user store
│       │   ├── Session.js          token blacklist
│       │   └── Activity.js         activity store (create, findByUserId, deleteById)
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── activityRoutes.js   GET /, DELETE /:id
│       │   └── documentRoutes.js
│       ├── services/
│       │   └── aiService.js        HTTP client with exponential backoff retry
│       └── utils/
│           └── jwt.js
│
├── ai-service/
│   └── app/
│       ├── main.py                 FastAPI app, file cache, threadpool
│       ├── config.py               env var config
│       ├── ocr/
│       │   ├── ocr_engine.py       PaddleOCR wrapper (mobile model, no heavy pipeline)
│       │   ├── pdf_processor.py    PDF → image conversion
│       │   ├── native_text_extractor.py  PyMuPDF native text
│       │   └── table_parser.py     table extraction
│       └── services/
│           ├── document_services.py  orchestrates OCR pipeline
│           └── word_export_service.py  PDF → Word conversion
│
├── docker-compose.yml              healthcheck, mem_limit, mobile model env
└── *.md                            documentation
```

## In-Memory Storage

All data resets on container restart. Migration path:
- Replace `User.js` with Sequelize/Mongoose model
- Replace `Activity.js` with DB model
- Replace `Session.js` blacklist with Redis or DB table
- No frontend or route changes needed

See `DATABASE_MIGRATION_GUIDE.md` for step-by-step instructions.

## Key Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `OCR_CPU_THREADS` | 2 | PaddleOCR CPU threads |
| `OCR_FALLBACK_DPI` | 200 | DPI for scanned page rendering |
| `OCR_MAX_SIDE` | 1600 | Max image side before downscale |
| `OCR_ENABLE_PREPROCESSING` | false | Enable grayscale/denoise/Otsu/deskew |
| `OCR_DET_MODEL` | PP-OCRv5_mobile_det | Detection model (mobile = lower RAM) |
| `JWT_SECRET` | (change in prod) | JWT signing secret |
| `JWT_EXPIRES_IN` | 24h | Token lifetime |
