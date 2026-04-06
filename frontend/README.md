# Frontend

The frontend is a React + Vite single-page application for authentication, PDF upload, OCR result viewing, AI chat, document history, and file export actions.

## Stack

- React 19
- Vite 7
- React Router DOM 6
- Axios

## User Flow

1. User logs in or registers.
2. User uploads a PDF from the dashboard.
3. OCR result is displayed with:
   - extracted images
   - text view
   - JSON view
4. User can:
   - open AI chat
   - download Excel
   - download Word
5. User can open History to restore old document sessions.

## Main Pages

- `src/pages/Login.jsx`
- `src/pages/Register.jsx`
- `src/pages/ForgotPassword.jsx`
- `src/pages/ResetPassword.jsx`
- `src/pages/Home.jsx`
- `src/pages/Upload.jsx`
- `src/pages/History.jsx`
- `src/pages/AIChat.jsx`

## Important Frontend Features

- protected routes with auth context
- OCR result caching in local storage
- active document persistence for AI chat
- Enter-to-send chat behavior
- quick actions for AI chat
- file-grouped history cards
- history restore back to dashboard

## Backend APIs Used

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/profile`
- `GET /api/auth/verify`
- `POST /upload`
- `POST /download-word`
- `GET /api/activities`
- `GET /api/activities/:id`
- `POST /api/activities/:id/download-word`
- `DELETE /api/activities/:id`
- `POST /api/ai/chat`
- `POST /api/ai/export-excel`

## Environment

Create a frontend env file if needed:

```env
VITE_API_URL=http://localhost:5000
```

The Docker setup already injects this value for local development.

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

App URL: `http://localhost:5173`

## Build and Lint

```bash
npm run lint
npm run build
npm run preview
```

## Key Files

- `src/App.jsx`
- `src/services/api.js`
- `src/components/UploadBox.jsx`
- `src/components/ResultBox.jsx`
- `src/pages/AIChat.jsx`
- `src/pages/History.jsx`
- `src/styles/main.css`
