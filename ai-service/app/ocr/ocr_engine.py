import os
import gc
import cv2
import logging

import easyocr
from app.config import (
    OCR_LANGUAGE,
    OCR_CPU_THREADS,
    OCR_MAX_SIDE,
    OCR_ENABLE_PREPROCESSING,
)

# EasyOCR language map — config uses 'en', easyocr uses ['en']
_LANG_MAP = {
    "en": ["en"],
    "ch": ["ch_sim", "en"],
    "chinese_cht": ["ch_tra", "en"],
    "japan": ["ja", "en"],
    "korean": ["ko", "en"],
    "fr": ["fr", "en"],
    "german": ["de", "en"],
    "arabic": ["ar"],
    "hi": ["hi"],
}

_ocr_reader = None


def _get_ocr():
    global _ocr_reader
    if _ocr_reader is None:
        lang = OCR_LANGUAGE or "en"
        languages = _LANG_MAP.get(lang, ["en"])
        logging.info("Initializing EasyOCR with languages: %s", languages)
        _ocr_reader = easyocr.Reader(
            languages,
            gpu=False,
            verbose=False,
        )
        logging.info("EasyOCR ready.")
    return _ocr_reader


def _parse_easyocr_result(result):
    """Convert EasyOCR output to standard block format.

    EasyOCR returns: [(bbox, text, confidence), ...]
    bbox is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
    """
    blocks = []
    for item in (result or []):
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        bbox = item[0]
        text = str(item[1]).strip() if len(item) > 1 else ""
        confidence = float(item[2]) if len(item) > 2 else None
        if not text:
            continue
        # Normalise bbox to list of lists
        if hasattr(bbox, "tolist"):
            bbox = bbox.tolist()
        blocks.append({"text": text, "confidence": confidence, "bbox": bbox})
    return blocks


def _text_signal_score(blocks):
    joined = " ".join(
        str(b.get("text", "")).strip() for b in blocks if isinstance(b, dict)
    )
    return sum(1 for c in joined if c.isalnum())


def _resize_image_for_ocr(image_path):
    image = cv2.imread(image_path)
    if image is None:
        return None
    h, w = image.shape[:2]
    longest = max(h, w)
    if longest <= OCR_MAX_SIDE:
        return None
    ratio = OCR_MAX_SIDE / float(longest)
    resized = cv2.resize(image, None, fx=ratio, fy=ratio, interpolation=cv2.INTER_AREA)
    out_path = f"{os.path.splitext(image_path)[0]}_scaled.png"
    cv2.imwrite(out_path, resized)
    return out_path


def _prepare_image_for_ocr(image_path):
    image = cv2.imread(image_path)
    if image is None:
        return None
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    if max(h, w) < 1800:
        gray = cv2.resize(gray, None, fx=1.3, fy=1.3, interpolation=cv2.INTER_CUBIC)
    # Use a fast bilateral filter to preserve edges and reduce noise instead of extremely slow non-local means denoising
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)
    thresh = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )
    out_path = f"{os.path.splitext(image_path)[0]}_ocrprep.png"
    cv2.imwrite(out_path, thresh)
    return out_path


def run_ocr(image_path):
    temp_files = []
    primary = image_path

    try:
        # Resize large images to stay within memory limits
        try:
            resized = _resize_image_for_ocr(image_path)
            if resized:
                primary = resized
                temp_files.append(resized)
        except Exception:
            logging.exception("Resize failed for %s", image_path)

        reader = _get_ocr()
        raw = reader.readtext(primary, detail=1, paragraph=False)
        primary_blocks = _parse_easyocr_result(raw)

        if not OCR_ENABLE_PREPROCESSING:
            return primary_blocks

        # Optionally run on preprocessed image and pick the better result
        prepped = None
        try:
            prepped = _prepare_image_for_ocr(primary)
            if prepped:
                temp_files.append(prepped)
        except Exception:
            logging.exception("Preprocessing failed for %s", primary)

        if not prepped:
            return primary_blocks

        raw2 = reader.readtext(prepped, detail=1, paragraph=False)
        prepped_blocks = _parse_easyocr_result(raw2)

        if _text_signal_score(prepped_blocks) > _text_signal_score(primary_blocks):
            return prepped_blocks
        return primary_blocks

    except Exception:
        logging.exception("OCR failed for image %s", primary)
        return []
    finally:
        for f in temp_files:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except OSError:
                    pass
        gc.collect()
