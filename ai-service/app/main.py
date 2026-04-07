from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool
import hashlib
import os
import logging
from pathlib import Path
from uuid import uuid4

from app.services.document_services import process_document
from app.services.word_export_service import convert_extracted_data_to_word_doc, convert_pdf_to_word_doc
from app.config import UPLOAD_FOLDER, WORD_EXPORT_FOLDER

app = FastAPI(title="OCR AI Service")

# In-memory result cache keyed by SHA-256 file hash (max 50 entries, FIFO eviction)
_ocr_cache: dict = {}
_MAX_CACHE = 50


class WordExportRequest(BaseModel):
    document_data: dict
    document_name: str = "OCR Document"


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


@app.post("/process-document")
async def process_document_api(file: UploadFile = File(...)):
    if file is None or file.filename == "":
        raise HTTPException(status_code=422, detail="File upload is required")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_path = None

    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        suffix = Path(file.filename).suffix or ".pdf"
        file_path = os.path.join(UPLOAD_FOLDER, f"{uuid4().hex}{suffix}")

        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        # Return cached result for identical files
        file_key = _sha256(file_path)
        cached = _cache_get(file_key)
        if cached is not None:
            logging.info("Cache hit for %s", file.filename)
            return cached

        # Run CPU-bound OCR in thread pool — keeps event loop free
        result = await run_in_threadpool(process_document, file_path)
        _cache_set(file_key, result)
        return result

    except Exception as exc:
        logging.exception("Failed to process uploaded PDF %s", file.filename)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(exc)}")
    finally:
        _remove_file_if_exists(file_path)
        _remove_dir_if_empty(UPLOAD_FOLDER)


@app.post("/convert-pdf-to-word")
async def convert_pdf_to_word_api(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
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
            buffer.write(await file.read())

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
