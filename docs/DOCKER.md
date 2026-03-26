# Docker Deployment Guide: TextTrack AI

The entire system is containerized for consistent deployment across any environment.

## Services
1. **ocr-frontend**: Nginx serving the React build.
2. **ocr-backend**: Node.js runtime.
3. **ocr-ai-service**: Python 3.10 runtime with PaddleOCR dependencies.
4. **ocr-postgres**: PostgreSQL 15 database.

## 🌉 Internal Networking (The Bridge)
Docker creates a virtual software-defined network for these services. 
- **DNS Resolution**: The Node.js backend connects to the AI service using the hostname `http://ai-service:8000`. Docker's internal DNS translates this to the container's private IP.
- **Volume Persistence**: Database data is stored in a **Docker Volume**, ensuring that even if you shut down every container, your user history and credentials remain safe on the host hard drive.

## Quick Start (Official Onboarding)
The recommended way to run the project is using Docker Compose.

```bash
# Clone the repository
git clone https://github.com/your-username/ocr-document-system.git
cd ocr-document-system

# Start all services
docker-compose up --build
```

## Management Commands
- **Stop**: `docker-compose down`
- **Rebuild specific service**: `docker-compose build backend`
- **View Logs**: `docker-compose logs -f ai-service`

## Troubleshooting
- **OOM (Out of Memory)**: Ensure Docker Desktop has at least 4GB RAM allocated. The AI service is capped at 3GB.
- **Model Loading**: The first boot for the AI service takes longer (~1-2 mins) as it initializes the OCR models.
