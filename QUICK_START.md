# Quick Start Guide

## Getting Started in 5 Minutes

### Option 1: Docker (Recommended)

1. Make sure Docker Desktop is running

2. Clone and start the application:
```bash
docker compose up --build
```

3. Open your browser:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5000
   - AI Service: http://localhost:8000

4. Create an account:
   - Click "Create account" on the login page
   - Fill in your name, email, and password
   - You'll be automatically logged in

5. Upload a PDF:
   - Click "Choose File" and select a PDF
   - Click "Upload & Process"
   - View extracted text, tables, and images
   - Download as Word document

6. View your activity:
   - Click "View History" to see all your uploads

### Option 2: Local Development

#### 1. Start AI Service
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Start Backend (new terminal)
```bash
cd backend
npm install
npm run dev
```

#### 3. Start Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

#### 4. Open http://localhost:5173 and create an account

## First Time Setup

### 1. Register a New Account
- Navigate to http://localhost:5173
- Click "Create account"
- Enter your details:
  - Full Name: Your name
  - Email: your@email.com
  - Password: At least 6 characters
- Click "Create Account"

### 2. You're Logged In!
You'll see:
- Your name in the top right corner
- A logout button
- The main upload interface

### 3. Upload Your First Document
- Click "Choose File"
- Select a PDF file
- Click "Upload & Process"
- Wait for processing (usually 5-30 seconds)
- View results:
  - Extracted text
  - Tables (if any)
  - Embedded images (if any)

### 4. Download as Word
- After processing, click "Download Word"
- A .docx file will be downloaded with all content

### 5. View Your History
- Click "View History" link
- See all your past uploads
- Check success/failure status
- View file names and sizes

## Testing the API

### Register via API
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Login via API
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the token from the response!

### Upload Document via API
```bash
curl -X POST http://localhost:5000/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@/path/to/document.pdf"
```

### Get Activity History via API
```bash
curl -X GET http://localhost:5000/api/activities \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Common Issues

### "No token provided" error
- Make sure you're logged in
- Token expires after 24 hours - log in again

### "AI service is unavailable"
- Check if AI service is running on port 8000
- Run: `docker compose logs ai-service`

### Can't upload files
- Make sure you're logged in
- Check file is a PDF
- Check file size (large files take longer)

### Docker issues
```bash
# Stop all containers
docker compose down

# Rebuild from scratch
docker compose build --no-cache

# Start again
docker compose up
```

## What's Next?

### Current Features (In-Memory)
- User registration and login
- JWT authentication
- Activity tracking
- OCR processing
- Word export

### Coming Soon (Database Integration)
- Persistent user data
- Password reset via email
- Google OAuth login
- Email verification
- User profile management
- Document storage

See [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) for:
- Complete API documentation
- Database migration guide
- Security features
- Future enhancements

## Tips

1. **Session Duration**: Tokens last 24 hours. After that, log in again.

2. **Activity Tracking**: Every upload and export is tracked automatically.

3. **File Support**: Currently only PDF files are supported.

4. **Processing Time**: Depends on PDF size and complexity:
   - Small PDFs (1-5 pages): 5-10 seconds
   - Medium PDFs (5-20 pages): 10-30 seconds
   - Large PDFs (20+ pages): 30+ seconds

5. **Memory Storage**: User data is stored in memory (resets on server restart). Database integration coming soon!

## Need Help?

- Check [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) for detailed docs
- Check [README.md](./README.md) for system overview
- Check Docker logs: `docker compose logs -f`
- Check backend logs in terminal
- Check browser console for frontend errors

## Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ JWT Token
       ↓
┌─────────────┐
│   Backend   │
│  (Express)  │
│  + Auth     │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ AI Service  │
│  (FastAPI)  │
│  + OCR      │
└─────────────┘
```

## Security Notes

- Passwords are hashed with bcrypt (10 rounds)
- JWT tokens expire after 24 hours
- Tokens are stored in localStorage
- All OCR endpoints require authentication
- CORS is enabled for development

## Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Set up database (PostgreSQL/MySQL)
- [ ] Enable HTTPS
- [ ] Set up email service for password reset
- [ ] Configure Google OAuth credentials
- [ ] Set up proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up logging and monitoring
- [ ] Configure file upload limits
- [ ] Set up backup strategy

Happy coding! 🚀
