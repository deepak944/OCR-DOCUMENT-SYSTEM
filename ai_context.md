# Master AI Context: TextTrack AI OCR System

This document serves as the "Single Source of Truth" for the TextTrack AI project. It contains every technical nuance, architectural decision, and implementation detail required for an AI or engineer to understand, replicate, or extend the system.

---

## 🏗 1. High-Level Architecture
TextTrack AI is a **containerized 3-tier microservices-style application**.

- **Frontend**: React (Vite) SPA. Port 5173.
- **Backend (Orchestrator)**: Node.js/Express. Port 5000.
- **AI Service (Worker)**: Python FastAPI. Port 8000.
- **Database**: PostgreSQL 15. Port 5432.

### Request Flow
1. **User → Frontend**: Drops a PDF.
2. **Frontend → Backend**: Axios POST `multipart/form-data` with JWT.
3. **Backend → Database**: Creates an "Activity" log (status: 'processing').
4. **Backend → AI Service**: Streams PDF via internal Docker network.
5. **AI Service**: Runs OCR/Table parsing -> Returns JSON.
6. **Backend → Database**: Updates Activity (status: 'success').
7. **Backend → Frontend**: Returns final JSON.

---

## 🛠 2. Technology Stack (The "Pin-to-Pin" Tech)

### Frontend (React 19 + Vite)
- **Virtual DOM**: React handles UI updates efficiently by only re-rendering changed elements.
- **Vite**: Modern builder using native ES modules for instant Hot Module Replacement (HMR).
- **Core Hooks**: `useState`, `useEffect`, `useContext` (for `AuthContext`).
- **Axios Interceptors**: Automatically injects `Authorization: Bearer <token>` into every request.
- **Routing**: `react-router-dom v6` with `ProtectedRoute` wrappers.

### Backend (Node.js + Express)
- **Runtime**: Node.js (Asynchronous, Non-blocking I/O).
- **Middleware Pipeline**: 
  - `authMiddleware.js`: Verifies JWT HMAC SHA256 signatures.
  - `uploadMiddleware.js`: Uses **Multer** to handle file storage/buffering.
- **Security**: 
  - **JWT (JSON Web Tokens)**: Stateless authentication.
  - **Bcrypt**: Password hashing with a cost factor of 10.
- **ORM**: **Sequelize** for PostgreSQL interaction, preventing SQL injection.

### AI Service (Python 3.10 + FastAPI)
- **FastAPI**: High-performance ASGI framework with Pydantic validation.
- **Uvicorn**: Lightning-fast ASGI server for handling concurrent OCR tasks.
- **OCR Engine**: **PaddleOCR (PP-OCRv5)**. 
  - *Stages*: Detection (ResNet) -> Classification -> Recognition (Transformer).
- **Hybrid Logic**: Uses `PyMuPDF` (Native Text) first; falls back to OCR if words < 12.
- **Table Parsing**: **Camelot** for structural table extraction.
- **Doc Generation**: `python-docx` for MS Word reconstruction.

### Database (PostgreSQL)
- **ACID Compliance**: Ensures data integrity and reliable transactions.
- **JSONB Support**: Potential for storing unstructured OCR blobs.
- **Relational Models**: `User`, `Activity` (History), `Session` (Blacklist).

---

## 📂 3. Folder Structure & Key Files

```text
ocr-document-system/
├── frontend/ (React SPA)
│   ├── src/
│   │   ├── context/AuthContext.jsx    # Global Auth State
│   │   ├── services/api.js            # Axios Central Config
│   │   ├── components/UploadBox.jsx   # File Upload UI
│   │   └── components/ResultBox.jsx   # OCR Display Logic
├── backend/ (Node.js API)
│   ├── server.js                      # Entry Point
│   ├── src/
│   │   ├── middleware/authMiddleware.js # JWT Sentinel
│   │   ├── models/User.js             # DB Schema
│   │   ├── services/aiService.js      # Bridge to Python
│   │   └── controllers/document.js    # Upload Orchestration
├── ai-service/ (Python AI)
│   ├── app/
│   │   ├── main.py                    # FastAPI Routes + SHA-256 Cache
│   │   ├── services/ocr_logic.py      # Vision Pipeline
│   │   └── ocr/native_extractor.py    # PyMuPDF Logic
├── docker-compose.yml                 # Multi-container Orchestration
└── ai_context.md                      # This Master Context
```

---

## 🔐 4. Authentication & Security Nuances
- **JWT Statelessness**: The server does NOT store sessions. It only verifies the cryptographic signature of the token provided by the client. This allows for horizontal scaling.
- **Token Storage**: Stored in `localStorage` on the frontend.
- **Password Security**: Never stored in plain text. Bcrypt hashes are irreversible.

---

## 🐳 5. Containerization Details
- **Networking**: Bridge network allows services to communicate via hostnames (e.g., `http://ai-service:8000`).
- **Internal DNS**: Docker's embedded DNS server resolves container names to internal IPs.
- **Persistence**: PostgreSQL uses a Docker **Volume** to ensure data survives container restarts.

---

## 📈 6. Industry Perspective & Design Patterns
1. **Separation of Concerns (SoC)**: UI, Business Logic, and Heavy Computation are decoupled.
2. **Event-Loop Efficiency**: Node.js handles I/O while Python handles CPU-bound OCR tasks.
3. **Observability**: Structured logs in every service for debugging production flows.
4. **Resiliency**: Timeouts and retries are implemented in the Backend -> AI Service bridge.

---

## 🚀 7. Environment & Setup (The "AI Copy-Paste" Environment)
- **Port Mapping**: 5173 (FE), 5000 (BE), 8000 (AI), 5432 (DB).
- **Node Version**: 18+
- **Python Version**: 3.10+
- **Commands**: 
  - Root: `docker-compose up --build`
  - Backend: `npm install && npm run start`
  - AI Service: `pip install -r requirements.txt && uvicorn app.main:app`

---
*End of Master Context*
