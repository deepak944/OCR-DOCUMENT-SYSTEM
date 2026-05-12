import os
import logging
import hashlib
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool

from app.services.document_services import process_document
from app.services.word_export_service import convert_extracted_data_to_word_doc, convert_pdf_to_word_doc
from app.config import UPLOAD_FOLDER, WORD_EXPORT_FOLDER

app = FastAPI(title="OCR AI Service")

# Upload guard defaults (can be overridden via env vars)
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(500 * 1024 * 1024)))  # 500MB default (match frontend)
UPLOAD_PROGRESS_CHUNK_BYTES = int(os.getenv("UPLOAD_PROGRESS_CHUNK_BYTES", str(4 * 1024 * 1024)))  # 4MB default

# In-memory result cache keyed by SHA-256 file hash (max 50 entries, FIFO eviction)
_ocr_cache: dict = {}
_MAX_CACHE = 50


class WordExportRequest(BaseModel):
    document_data: dict
    document_name: str = "OCR Document"
    language: str = "en"


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _cache_get(key: str):
    return _ocr_cache.get(key)


def _cache_set(key: str, value):
    if len(_ocr_cache) >= _MAX_CACHE:
        _ocr_cache.pop(next(iter(_ocr_cache)))
    _ocr_cache[key] = value


def _remove_file_if_exists(file_path):
    if file_path and os.path.exists(file_path):
        os.remove(file_path)


def _remove_dir_if_empty(dir_path):
    if not dir_path or not os.path.isdir(dir_path):
        return

    if not os.listdir(dir_path):
        os.rmdir(dir_path)


@app.get("/")
def home():
    return {"message": "OCR Service Running"}


@app.get("/health")
def health():
    """Healthcheck endpoint used by docker-compose to gate backend startup."""
    return {"status": "ok"}


@app.post("/process-document")
async def process_document_api(file: UploadFile = File(...), language: str = "en"):
    if file is None or file.filename == "":
        raise HTTPException(status_code=422, detail="File upload is required")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_path = None

    started_at = None
    bytes_written = 0

    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        suffix = Path(file.filename).suffix or ".pdf"
        file_path = os.path.join(UPLOAD_FOLDER, f"{uuid4().hex}{suffix}")

        started_at = __import__("time").time()

        # Best-effort: UploadFile doesn't always provide content-length.
        # We enforce a hard cap while streaming to disk.
        with open(file_path, "wb") as buffer:
            last_log_t = started_at
            while True:
                chunk = await file.read(UPLOAD_PROGRESS_CHUNK_BYTES)
                if not chunk:
                    break

                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max allowed is {MAX_UPLOAD_BYTES / (1024 * 1024):.0f}MB"
                    )

                buffer.write(chunk)

                # Log every ~3 seconds to see forward progress on large uploads
                now = __import__("time").time()
                if now - last_log_t >= 3:
                    mb = bytes_written / (1024 * 1024)
                    logging.info("Uploading %s: wrote %.1fMB so far", file.filename, mb)
                    last_log_t = now

        logging.info("Upload complete for %s: %.1fMB in %.2fs",
                     file.filename,
                     bytes_written / (1024 * 1024),
                     (__import__("time").time() - started_at))

        # Return cached result for identical files
        file_key = _sha256(file_path)
        cached = _cache_get(file_key)
        if cached is not None:
            logging.info("Cache hit for %s", file.filename)
            return cached

        # Run CPU-bound OCR in thread pool — keeps event loop free
        ocr_started_at = __import__("time").time()
        logging.info("OCR processing start: %s (cache_key=%s)", file.filename, file_key)
        result = await run_in_threadpool(process_document, file_path)
        logging.info("OCR processing done: %s in %.2fs", file.filename, __import__("time").time() - ocr_started_at)
        _cache_set(file_key, result)
        return result

    except Exception as exc:
        logging.exception("Failed to process uploaded PDF %s", file.filename)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(exc)}")
    finally:
        _remove_file_if_exists(file_path)
        _remove_dir_if_empty(UPLOAD_FOLDER)


@app.post("/convert-pdf-to-word")
async def convert_pdf_to_word_api(background_tasks: BackgroundTasks, file: UploadFile = File(...), language: str = "en"):
    if file is None or file.filename == "":
        raise HTTPException(status_code=422, detail="File upload is required")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    request_pdf_path = None
    word_file_path = None

    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(WORD_EXPORT_FOLDER, exist_ok=True)

        request_pdf_name = f"{uuid4().hex}.pdf"
        request_pdf_path = os.path.join(UPLOAD_FOLDER, request_pdf_name)

        with open(request_pdf_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)

        original_stem = Path(file.filename).stem or "document"
        word_file_name = f"{original_stem}-{uuid4().hex[:8]}.docx"
        word_file_path = os.path.join(WORD_EXPORT_FOLDER, word_file_name)

        await run_in_threadpool(convert_pdf_to_word_doc, request_pdf_path, word_file_path)

        response = FileResponse(
            path=word_file_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{original_stem}.docx"
        )
        background_tasks.add_task(_remove_file_if_exists, word_file_path)
        background_tasks.add_task(_remove_dir_if_empty, WORD_EXPORT_FOLDER)
        return response

    except Exception as exc:
        logging.exception("Failed to convert uploaded PDF %s", file.filename)
        raise HTTPException(status_code=500, detail=f"Failed to convert document: {str(exc)}")
    finally:
        _remove_file_if_exists(request_pdf_path)
        _remove_dir_if_empty(UPLOAD_FOLDER)


@app.post("/convert-ocr-json-to-word")
async def convert_ocr_json_to_word_api(payload: WordExportRequest, background_tasks: BackgroundTasks):
    word_file_path = None

    try:
        if not isinstance(payload.document_data, dict):
            raise HTTPException(status_code=422, detail="document_data must be an object")

        os.makedirs(WORD_EXPORT_FOLDER, exist_ok=True)

        original_stem = Path(payload.document_name or "document").stem or "document"
        word_file_name = f"{original_stem}-{uuid4().hex[:8]}.docx"
        word_file_path = os.path.join(WORD_EXPORT_FOLDER, word_file_name)

        await run_in_threadpool(convert_extracted_data_to_word_doc, payload.document_data, word_file_path)

        response = FileResponse(
            path=word_file_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{original_stem}.docx"
        )
        background_tasks.add_task(_remove_file_if_exists, word_file_path)
        background_tasks.add_task(_remove_dir_if_empty, WORD_EXPORT_FOLDER)
        return response

    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Failed to convert OCR JSON to Word %s", payload.document_name)
        raise HTTPException(status_code=500, detail=f"Failed to convert OCR data to Word: {str(exc)}")

# Backward-compatible ASGI alias for commands using `app.main:main`.
main = app
