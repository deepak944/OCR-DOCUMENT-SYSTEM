# AI Context — OCR Document Processing System

Last updated: 2026-03-18

## Project Overview

Full-stack OCR document processing system with three services:
- `frontend/` — React + Vite SPA (existing design preserved)
- `backend/` — Node.js / Express REST API
- `ai-service/` — Python FastAPI OCR engine (PaddleOCR)

All three run in Docker via `docker-compose.yml`.

---

## Architecture

```
Browser → frontend (port 5173)
             ↓ REST
         backend (port 5000)
             ↓ HTTP
         ai-service (port 8000)
```

---

## Authentication Flow

- `POST /api/auth/register` — creates user, returns `{ message, user }` (NO token). Frontend redirects to `/login` with `state: { registered: true }`.
- `POST /api/auth/login` — returns `{ user, token }`. Frontend stores token in `localStorage`.
- `POST /api/auth/logout` — blacklists token server-side.
- `GET /api/auth/verify` — validates token, returns user info.
- All protected routes require `Authorization: Bearer <token>` header.
- `ProtectedRoute` component redirects unauthenticated users to `/login`.
- `Login.jsx` reads `location.state.registered` to show a success banner after registration.

---

## Backend (Node.js / Express)

### Key files
| File | Purpose |
|------|---------|
| `server.js` | Entry point, Express setup |
| `src/routes/authRoutes.js` | Auth endpoints |
| `src/routes/documentRoutes.js` | Upload + Word export |
| `src/routes/activityRoutes.js` | History CRUD |
| `src/controllers/authController.js` | Register (no token), login, logout, profile |
| `src/controllers/documentController.js` | OCR upload, Word download |
| `src/controllers/activityController.js` | getUserActivities + deleteActivity |
| `src/models/User.js` | In-memory user store |
| `src/models/Activity.js` | In-memory activity store (create, findByUserId, deleteById, deleteByUserId) |
| `src/models/Session.js` | Token blacklist |
| `src/middleware/authMiddleware.js` | JWT verification |
| `src/services/aiService.js` | HTTP client to ai-service |

### Activity endpoints
- `GET /api/activities` — user's history (auth required)
- `DELETE /api/activities/:id` — delete specific record (auth required, user-scoped)

### Dependencies (package.json)
- `bcryptjs`, `jsonwebtoken`, `form-data` — were missing, now added
- `react-router-dom` — was missing from frontend, now added
- Both Dockerfiles use `npm install` (not `npm ci`) to resolve fresh

---

## AI Service (FastAPI / PaddleOCR)

### Key files
| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, endpoints, SHA-256 file cache, run_in_threadpool |
| `app/config.py` | Config (DPI=300, MAX_SIDE=3000, preprocessing=True) |
| `app/services/document_services.py` | Orchestrates native + OCR extraction |
| `app/services/word_export_service.py` | PDF → Word conversion |
| `app/ocr/pdf_processor.py` | PDF → image conversion (fitz) |
| `app/ocr/ocr_engine.py` | PaddleOCR wrapper with preprocessing + deskew |
| `app/ocr/native_text_extractor.py` | Native text via PyMuPDF |
| `app/ocr/table_parser.py` | Table extraction |

### OCR Performance Improvements
- `run_in_threadpool()` — OCR and Word export run in thread pool, keeps FastAPI event loop free
- SHA-256 file hash cache (`_ocr_cache`) — identical files skip re-processing (max 50 entries, FIFO eviction)
- `OCR_FALLBACK_DPI=300` (was 220) — better quality for scanned docs
- `OCR_MAX_SIDE=3000` (was 1800) — prevents downscaling scanned pages
- `OCR_ENABLE_PREPROCESSING=True` (was False) — enables grayscale, denoise, Otsu threshold, deskew
- Deskew step corrects rotation artifacts from physical scanning
- Otsu thresholding replaces adaptive threshold (better for uneven scan lighting)

### Scanned PDF flow
1. `extract_pdf_text_blocks()` — try native text extraction
2. If page has < 12 words or < 60 alnum chars → trigger OCR
3. Convert page to PNG at 300 DPI
4. Optionally preprocess (grayscale → denoise → Otsu threshold → deskew)
5. Run PaddleOCR on both raw and preprocessed; pick best result by alnum char count
6. If native text is sparse (< 60 alnum chars), always prefer OCR result

---

## Frontend (React + Vite)

### Design policy
The existing visual design (colors, fonts, layout, component structure) is preserved exactly.
Only logic, functionality, and minimal additive CSS classes are changed.

### Routes
| Path | Component | Protected |
|------|-----------|-----------|
| `/` | `Home` (OCR extractor) | ✅ |
| `/upload` | `Upload` (same as Home, uses UploadBox + ResultBox) | ✅ |
| `/history` | `History` | ✅ |
| `/login` | `Login` | ❌ |
| `/register` | `Register` | ❌ |
| `/forgot-password` | `ForgotPassword` | ❌ |

### Key components
| File | Purpose |
|------|---------|
| `context/AuthContext.jsx` | Auth state; register no longer stores token |
| `components/ProtectedRoute.jsx` | Redirect to /login if not authenticated |
| `components/Navbar.jsx` | Added Dashboard + History nav links (`.navbar-nav-link`) |
| `components/UploadBox.jsx` | File upload with loading/error states (unchanged) |
| `components/ResultBox.jsx` | OCR result display + Word download (unchanged) |
| `components/Loader.jsx` | Simple loading text (minimal fix) |
| `pages/Home.jsx` | OCR extractor with UploadBox + ResultBox (unchanged) |
| `pages/Upload.jsx` | Now wired up — uses same UploadBox + ResultBox as Home |
| `pages/History.jsx` | Activity list with per-record delete button |
| `pages/Login.jsx` | Shows `.auth-info` success banner when coming from register |
| `pages/Register.jsx` | Redirects to `/login` with `state.registered=true` on success |
| `services/api.js` | Added `deleteActivity(id)` |

### New CSS classes added (appended to main.css, nothing removed)
- `.navbar-nav-link` — nav links in navbar
- `.activity-header-right` — flex container for badge + delete button
- `.delete-activity-btn` — trash icon button on history cards

---

## Environment Variables

### backend/.env
```
PORT=5000
AI_SERVICE_URL=http://ai-service:8000
JWT_SECRET=<change-in-production>
JWT_EXPIRES_IN=24h
```

### frontend/.env
```
VITE_API_URL=http://localhost:5000
```

---

## In-Memory Storage (temporary)

All data resets on restart. To persist later:
- Replace `UserStore` with DB model (MongoDB/Postgres)
- Replace `ActivityStore` with DB model
- Replace `SessionStore` blacklist with Redis or DB table

---

## Docker

```bash
docker-compose down && docker-compose up --build
```

Both Dockerfiles use `npm install` to pick up all dependencies.
