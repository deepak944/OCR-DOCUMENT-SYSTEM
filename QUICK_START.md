# Quick Start Guide

## Option 1: Docker (Recommended)

1. Make sure Docker Desktop is running with at least 4 GB memory allocated.

2. Start the full stack:
```bash
docker compose up --build
```

3. Open your browser:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5000/health
   - AI Service: http://localhost:8000

4. Create an account:
   - Click "Create account" on the login page
   - Fill in your name, email, and password
   - After registration you'll be **redirected to the login page** — sign in with your new credentials

5. Upload a PDF:
   - Click "Choose File" and select a PDF
   - Click "Upload & Process"
   - View extracted text, tables, and images
   - Download as Word document

6. View your activity:
   - Click "History" in the navbar to see all your uploads
   - Delete individual records with the trash button

## Option 2: Local Development

```bash
# Terminal 1 — AI Service
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Backend
cd backend
npm install
npm run dev

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## First-Time User Flow

1. Navigate to http://localhost:5173 → redirected to `/login`
2. Click "Create account" → fill in name, email, password (min 6 chars)
3. Click "Create Account" → redirected back to login with a success message
4. Sign in with your credentials → land on the home page
5. Upload a PDF → wait for OCR processing (5–30 seconds depending on size)
6. View results: extracted text, tables, embedded images
7. Click "Download Word" to get a `.docx` file
8. Click "History" in the navbar to review past uploads

## API Quick Test

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login — copy the token from the response
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Upload a PDF
curl -X POST http://localhost:5000/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"

# View history
curl http://localhost:5000/api/activities \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Common Issues

| Problem | Fix |
|---------|-----|
| AI service exits with code 137 | OOM kill — increase Docker Desktop memory to 4+ GB |
| TLS handshake timeout during build | Docker network issue — restart Docker Desktop, or `docker pull node:20-alpine` manually |
| "socket hang up" on first upload | AI service still loading models — wait ~60s and retry |
| "No token provided" | You're not logged in, or token expired (24h) |
| Can't upload | File must be a PDF |

## Docker Troubleshooting

```bash
# View logs
docker compose logs -f

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up
```

## Notes

- Session tokens last 24 hours. After expiry, log in again.
- All user data is in-memory and resets on container restart. See `DATABASE_MIGRATION_GUIDE.md` to add persistence.
- Only PDF files are supported for upload.
- Processing time: ~5–10s for small PDFs, 30s+ for large scanned documents.
