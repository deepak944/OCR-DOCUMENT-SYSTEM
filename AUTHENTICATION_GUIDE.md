# Authentication & User Management Guide

## Overview

JWT-based authentication with bcrypt password hashing and user activity tracking. In-memory storage by default — see `DATABASE_MIGRATION_GUIDE.md` to add a persistent database.

## Auth Flow

1. User registers → server returns `{ message, user }` — **no token**
2. Frontend redirects to `/login` with `state: { registered: true }`
3. Login page shows a success banner when `location.state.registered === true`
4. User logs in → server returns `{ user, token }`
5. Token stored in `localStorage`, sent as `Authorization: Bearer <token>` on every request
6. On logout, token is blacklisted server-side and cleared from localStorage

## API Endpoints

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}

Response 201:
{
  "message": "User registered successfully. Please log in.",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-03-18T10:00:00.000Z"
  }
}
```

Note: no `token` field in the register response. User must log in manually.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "password123"
}

Response 200:
{
  "message": "Login successful",
  "user": { "id": 1, "name": "Jane Doe", "email": "jane@example.com" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>

Response 200:
{ "message": "Logout successful" }
```

### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>

Response 200:
{
  "user": { "id": 1, "name": "Jane Doe", "email": "jane@example.com", "createdAt": "..." }
}
```

### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <token>

Response 200:
{ "valid": true, "user": { "id": 1, "email": "jane@example.com", "name": "Jane Doe" } }
```

## Activity Endpoints

### Get History
```http
GET /api/activities?limit=50
Authorization: Bearer <token>

Response 200:
{
  "activities": [
    {
      "id": 1,
      "userId": 1,
      "action": "OCR_PROCESS",
      "fileName": "document.pdf",
      "fileSize": 102400,
      "status": "success",
      "timestamp": "2026-03-18T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

### Delete Activity
```http
DELETE /api/activities/:id
Authorization: Bearer <token>

Response 200:
{ "message": "Activity deleted" }
```

Only the owner of the activity can delete it (user-scoped).

## Document Endpoints (Protected)

```http
POST /upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
file: <PDF>

POST /download-word
Authorization: Bearer <token>
Content-Type: multipart/form-data
file: <PDF>
```

## Environment Variables

Backend (`backend/.env`):
```
PORT=5000
AI_SERVICE_URL=http://localhost:8000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

## Security

- Passwords hashed with bcrypt (10 salt rounds), never stored plain
- JWT tokens expire after 24 hours
- Logout blacklists the token server-side (in-memory Set)
- All OCR/export endpoints require a valid non-blacklisted token
- 401 responses trigger automatic redirect to `/login` in the frontend

## Testing via curl

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login (save the token)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Upload PDF
curl -X POST http://localhost:5000/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"

# Get history
curl http://localhost:5000/api/activities \
  -H "Authorization: Bearer YOUR_TOKEN"

# Delete activity
curl -X DELETE http://localhost:5000/api/activities/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "No token provided" | Missing Authorization header | Ensure you're logged in |
| "Invalid or expired token" | Token expired (24h) or blacklisted | Log in again |
| "User not found" | In-memory data reset on restart | Register again or add a database |
| 409 Conflict on register | Email already in use | Use a different email or log in |

## Future Enhancements

The UI already has placeholders for:
- Google OAuth (button exists on login/register pages)
- Password reset (ForgotPassword page exists)
- Email verification

See `DATABASE_MIGRATION_GUIDE.md` for how to add persistent storage and enable these features.
