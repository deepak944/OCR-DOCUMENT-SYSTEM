# TextTrack AI: Professional OCR Document System

TextTrack AI is an industry-grade, full-stack document intelligence platform. It seamlessly extracts text, tables, and images from both digital and scanned PDFs, transforming them into structured JSON and professional Word documents.

---

## 🚀 How to Start (Onboarding Guide)

Whether you are a developer looking to contribute or a user trying to run the system, here is how to get started.

### Option A: Running via GitHub (Stay in Sync)
1. **Clone the Project**:
   ```bash
   git clone https://github.com/deepak944/OCR-DOCUMENT-SYSTEM.git
   cd OCR-DOCUMENT-SYSTEM
   ```
2. **Start Services**:
   ```bash
   docker-compose up --build
   ```
3. **Stay Updated**:
   To pull the latest improvements from the team:
   ```bash
   git pull origin main
   ```

### Option B: Running without GitHub (Local Files)
If you have the project files directly on your machine:
1. Open a terminal in the project root folder.
2. Ensure **Docker Desktop** is running.
3. Run the following command:
   ```bash
   docker-compose up --build
   ```
4. Access the system at `http://localhost:5173`.

---

## 🛠 The Architecture (Brief Overview)

TextTrack AI consists of four primary layers that work in perfect harmony:

1. **The Interface (Frontend)**: A React-based SPA that provides a smooth, light-themed user experience. It communicates with the backend via secure API calls.
2. **The Orchestrator (Backend)**: A Node.js/Express server that manages users (PostgreSQL), handles security (JWT), and coordinates the OCR workflow.
3. **The Brain (AI Service)**: A Python FastAPI microservice that runs PaddleOCR to "read" your documents and `python-docx` to recreate them.
4. **The Storage (Database)**: A PostgreSQL instance that keeps your history and credentials safe.

---

## 📚 Deep Dive Documentation

For a comprehensive explanation of every file, tech, and API in each service, please read these dedicated guides in the `docs/` directory:

- 🖥️ **[Frontend Technical Details](./docs/FRONTEND.md)**: Deep dive into React, Vite, and Styling.
- ⚙️ **[Backend Technical Details](./docs/BACKEND.md)**: Deep dive into Node.js, JWT, and API Orchestration.
- 🧠 **[AI Service Technical Details](./docs/AI_SERVICE.md)**: Deep dive into FastAPI, **Uvicorn**, and OCR Logic.
- 🗄️ **[Database & Storage Details](./docs/DATABASE.md)**: Deep dive into PostgreSQL and Sequelize Models.
- 🐳 **[Docker & Deployment Guide](./docs/DOCKER.md)**: Deep dive into containerization and networking.

---

## 📈 Industry Perspective & Best Practices

TextTrack AI is designed with professional enterprise patterns in mind:
1. **Separation of Concerns (SoC)**: By decoupling the UI, API, and worker services, we ensure that a failure in the AI engine doesn't crash the user's login session.
2. **Stateless Scalability**: Using JWTs allows the backend to be "stateless," meaning we can run multiple instances of the backend behind a load balancer without needing "sticky sessions."
3. **Event-Driven Potential**: While currently using direct HTTP, the architecture is ready to be swapped with a Message Queue (RabbitMQ/Kafka) for high-scale asynchronous processing.
4. **Security by Design**: Password hashing with Bcrypt and ORM migration management are baked into the core to prevent common vulnerabilities.


---

## 📦 File Tech & API Summary
- **Frontend (`/frontend`)**: Powered by `Vite`. Communicates using `Axios`.
- **Backend (`/backend`)**: Powered by `Node.js`. Relies on `Sequelize` for database operations.
- **AI Service (`/ai-service`)**: Powered by `FastAPI` & `Uvicorn`. Uses `PaddleOCR` for high-precision extraction.
