import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_FOLDER = str(BASE_DIR / "uploads")
IMAGE_FOLDER = str(BASE_DIR / "temp_images")
WORD_EXPORT_FOLDER = str(BASE_DIR / "word_exports")
OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "en")


def _env_int(name, default):
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return default


def _env_bool(name, default=False):
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in ("1", "true", "yes", "on")


OCR_CPU_THREADS = _env_int("OCR_CPU_THREADS", 2)
OCR_FALLBACK_DPI = _env_int("OCR_FALLBACK_DPI", 250)
OCR_MAX_SIDE = _env_int("OCR_MAX_SIDE", 2200)
OCR_ENABLE_PREPROCESSING = _env_bool("OCR_ENABLE_PREPROCESSING", True)
# Stronger detector by default for scanned PDFs. Set OCR_DET_MODEL=PP-OCRv5_mobile_det
# if the deployment needs the smaller/lower-memory model.
OCR_DET_MODEL = os.getenv("OCR_DET_MODEL", "PP-OCRv5_server_det")
