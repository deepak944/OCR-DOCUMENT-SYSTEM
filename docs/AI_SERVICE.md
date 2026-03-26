# AI Service Documentation: TextTrack AI

The AI Service is a high-performance Python microservice built for document intelligence, OCR extraction, and file conversion.

## 🛠 Technology Stack Deep Dive

### 1. FastAPI
- **Speed**: Built on Starlette and Pydantic, FastAPI is one of the fastest Python frameworks available.
- **Asynchronous Design**: The service uses `async def` for endpoints, allowing it to handle long-running OCR tasks without blocking other requests.

### 2. Why Uvicorn?
- **ASGI Server**: Uvicorn is a lightning-fast ASGI (Asynchronous Server Gateway Interface) server implementation.
- **High Concurrency**: We use Uvicorn because it allows the AI service to run on an "Event Loop." This is critical because document processing is CPU-intensive; Uvicorn ensures that while one file is being processed, the server can still accept new connections and manage health checks.
- **Deployment**: In our Docker setup, Uvicorn serves as the robust interface between the internal networking and the FastAPI application logic.

### 3. PaddleOCR Engine (PP-OCRv5)
- **Multi-Stage Pipeline**: 
- **Detection**: Locates text box coordinates using a mobile-optimized ResNet-based vision model.
- **Classification**: A "Text Direction" model detects orientation (e.g., upside down) and deskews the image.
- **Recognition**: The character recognition stage uses a Deep Learning Transformer model (CRNN/SVTR) to convert pixels into text. 
> [!TIP]
> **Industry Note**: Python is chosen for this service because it is the global standard for ML/AI. Separating the AI into its own microservice allows for independent scaling of GPU/CPU resources without affecting the lightweight Node.js API Gateway.

### 4. Hybrid Extraction Logic
- **Native vs. OCR**: The service is smart. It first scans for "Native Text" (selectable text in a PDF) using `PyMuPDF`. 
- **The Fallback**: If it detects fewer than 12 words (indicating a scanned image or a "dead" PDF), it automatically triggers the full OCR pipeline. This saves significant CPU time for digital documents while ensuring 100% accuracy for scans.

## 📂 Internal Workflow

1. **Ingestion**: Receives a PDF file via FastAPI.
2. **Hashing**: Calculates a SHA-256 hash of the file. If this file was processed recently, it returns results from the **LRU Cache** instantly.
3. **Preprocessing**: If it's a scan, it applies grayscale and thresholding to clear up background "noise."
4. **Extraction**: Runs PaddleOCR and table parsing.
5. **Conversion**: Uses `python-docx` to recreate the document structure in Word format if requested.

## Configuration
Controlled via environment variables:
- `OCR_DET_MODEL`: Default `PP-OCRv5_mobile_det`.
- `MAX_SIDE`: Resolution limit for OCR processing.
- `OCR_CPU_THREADS`: Parallelism control for extraction.

## Development
To start locally:
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
