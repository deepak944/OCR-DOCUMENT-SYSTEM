# Backend Documentation: TextTrack AI

The backend is a robust Node.js/Express service that acts as the core orchestrator, managing users, securing data, and bridging the frontend with the AI processing engine.

## 🛠 Technology Stack Deep Dive

### 1. Node.js & Express.js
- **Asynchronous I/O**: We use Node.js because it's non-blocking, which is crucial when handling multiple concurrent file uploads and waiting for the AI microservice to respond.
- **Express**: Provides the routing framework and middleware support (CORS, JSON parsing, logging).

### 🔐 Authentication & Security
- **JWT**: Stateless authentication using JSON Web Tokens. When a user logs in, the backend generates a signed token containing the user's ID.
- **Google OAuth**: Integrated via `Passport.js` and `passport-google-oauth20`.
- **Bcrypt**: Securely hashes passwords before storage.
- **Nodemailer**: Handles password reset emails with fail-safe console logging.
- **Why JWT?**: It allows for **Stateless Authentication**, meaning the server doesn't need to store session IDs in memory; it simply verifies the cryptographic signature (HMAC SHA256) of the token provided by the client. This is essential for horizontal scaling in cloud environments.
- **Auth Middleware**: Located in `src/middleware/authMiddleware.js`. It acts as a "Request Sentinel," intercepting calls to protected routes, decoding the token, and attaching the `user` object to the request. If the token is expired or tampered with, it blocks the request immediately with a `401 Unauthorized`.

### 3. Database Management (Sequelize & PostgreSQL)
- **PostgreSQL**: A powerful relational database chosen for its reliability and support for UUIDs and complex relationships.
- **Sequelize ORM**: We use an Object-Relational Mapper to interact with the database using JavaScript classes instead of raw SQL. This prevents SQL injection attacks and makes the code cleaner.
- **Syncing**: The `sequelize.sync({ alter: true })` command ensures that the database tables always match the JavaScript models automatically.

### 4. API Orchestration
- **File Interception**: Using `multer`, the backend accepts file uploads, temporarily stores them, and then streams them to the AI service.
- **AI Integration**: The `src/services/aiService.js` uses `axios` to communicate with the Python service. It handles timeouts and retries to ensure reliable document processing.

## 📂 Core Logic Flow

1. **Registration**: Hashes the password using `bcrypt` (10 rounds) and saves the user to PostgreSQL.
2. **Document Processing**: 
   - Receives PDF via `POST /upload`.
   - Validates the user's JWT.
   - Forwards the PDF to the AI service.
   - Receives the JSON results.
   - Logs the `OCR_PROCESS` activity in the database.
   - Returns the JSON to the frontend.

## 📄 API Specifications
Detailed endpoint documentation can be found in the [Master README](../README.md#📄-key-api-inventory).

## Development
To start the backend locally:
```bash
cd backend
npm install
# Configure .env with DB credentials
npm run dev
```
Access via: `http://localhost:5000`
