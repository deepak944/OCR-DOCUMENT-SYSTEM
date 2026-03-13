from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_FOLDER = str(BASE_DIR / "uploads")
IMAGE_FOLDER = str(BASE_DIR / "temp_images")
WORD_EXPORT_FOLDER = str(BASE_DIR / "word_exports")
OCR_LANGUAGE = "en"
