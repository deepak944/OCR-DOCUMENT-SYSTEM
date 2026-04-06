# Backend

The backend is an Express API that authenticates users, stores activity history, communicates with the OCR service, generates Excel exports, and runs the Gemini-powered document assistant.

## Stack

- Node.js
- Express
- Sequelize
- PostgreSQL
- JWT
- Passport Google OAuth
- ExcelJS
- `@google/generative-ai`

## Responsibilities

- user registration and login
- JWT verification
- forgot/reset password flow
- Google OAuth callback
- OCR upload orchestration
- Word conversion proxying
- Excel export generation
- AI chat responses using OCR JSON
- activity logging and history restore

## Environment Variables

Create `backend/.env` from `backend/.env.example` and set:

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

## API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/profile`
- `GET /api/auth/verify`

### OCR and Conversion

- `POST /upload`
- `POST /download-word`

### AI Assistant

- `POST /api/ai/chat`
- `POST /api/ai/export-excel`

### Activity History

- `GET /api/activities`
- `GET /api/activities/:id`
- `POST /api/activities/:id/download-word`
- `DELETE /api/activities/:id`

## How It Works

1. The frontend sends a PDF upload to the backend.
2. The backend stores an archive copy for history reuse.
3. The backend forwards the file to the FastAPI OCR service.
4. The OCR result is returned as structured JSON and saved in `activities.metadata`.
5. The same OCR JSON is reused for:
   - AI chat
   - Excel export
   - history restore
6. Word downloads either use the current upload or a saved archived PDF from history.

## Important Backend Modules

- `server.js`
- `src/controllers/authController.js`
- `src/controllers/documentController.js`
- `src/controllers/aiController.js`
- `src/controllers/activityController.js`
- `src/services/geminiService.js`
- `src/services/excelExportService.js`
- `src/services/aiService.js`
- `src/services/activityHistoryService.js`
- `src/services/documentArchiveService.js`

## Run Locally

```bash
cd backend
npm install
npm run dev
```

Production start:

```bash
npm start
```

## Notes

- JSON body limit is configured to support large OCR payloads.
- OCR and AI routes are protected with auth middleware.
- Activity metadata is used to reopen document sessions from History.
