# Frontend (React + Vite)

Frontend app for uploading PDFs, viewing OCR output, previewing extracted images, and downloading Word output.

## Features
- PDF upload to backend
- OCR result JSON preview
- Extracted images gallery with metadata
- Word document download button

## Environment
Create `.env` from `.env.example`:

```env
VITE_API_URL=http://localhost:5000
```

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

Default URL: `http://localhost:5173`

## Build

```bash
npm run build
npm run preview
```
