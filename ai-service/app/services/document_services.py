from app.ocr.pdf_processor import (
    create_request_image_dir,
    convert_pdf_page_to_image,
    extract_embedded_images
)
from app.ocr.ocr_engine import run_ocr
from app.ocr.native_text_extractor import extract_pdf_text_blocks
from app.ocr.table_parser import extract_tables
from app.config import IMAGE_FOLDER
import logging
import gc
import os
import re
import shutil

MIN_NATIVE_WORDS_FOR_SKIP_OCR = 12
MIN_NATIVE_ALNUM_CHARS_FOR_SKIP_OCR = 60
OCR_REPLACEMENT_RATIO = 1.2


def _text_signal(blocks):
    joined_text = " ".join(
        str(block.get("text", "")).strip()
        for block in (blocks or [])
        if isinstance(block, dict)
    )

    words = re.findall(r"\w+", joined_text)
    alnum_chars = sum(1 for char in joined_text if char.isalnum())

    return {
        "words": len(words),
        "alnum_chars": alnum_chars
    }


def _should_try_ocr(native_blocks):
    if not native_blocks:
        return True

    signal = _text_signal(native_blocks)

    return (
        signal["words"] < MIN_NATIVE_WORDS_FOR_SKIP_OCR
        or signal["alnum_chars"] < MIN_NATIVE_ALNUM_CHARS_FOR_SKIP_OCR
    )


def _prefer_ocr_blocks(native_blocks, ocr_blocks):
    if not ocr_blocks:
        return native_blocks

    if not native_blocks:
        return ocr_blocks

    native_signal = _text_signal(native_blocks)
    ocr_signal = _text_signal(ocr_blocks)

    if ocr_signal["alnum_chars"] >= int(native_signal["alnum_chars"] * OCR_REPLACEMENT_RATIO):
        return ocr_blocks

    if native_signal["words"] < MIN_NATIVE_WORDS_FOR_SKIP_OCR and ocr_signal["words"] >= native_signal["words"]:
        return ocr_blocks

    return native_blocks


def process_document(pdf_path):
    pages = extract_pdf_text_blocks(pdf_path)
    request_dir = None
    results = []
    failed_pages = 0

    try:
        for page in pages:
            page_number = page["page_number"]
            native_blocks = page["blocks"]
            blocks = native_blocks

            if _should_try_ocr(native_blocks):
                image_path = None
                try:
                    if request_dir is None:
                        request_dir = create_request_image_dir(pdf_path)

                    image_path = convert_pdf_page_to_image(pdf_path, page_number, request_dir)
                    ocr_blocks = run_ocr(image_path)
                    blocks = _prefer_ocr_blocks(native_blocks, ocr_blocks)
                except Exception:
                    logging.exception("OCR failed for page %s in %s", page_number, pdf_path)
                    blocks = native_blocks
                    failed_pages += 1
                finally:
                    # Delete the page image immediately to free disk + memory
                    if image_path and os.path.exists(image_path):
                        try:
                            os.remove(image_path)
                        except OSError:
                            pass
                    gc.collect()

            results.append({
                "page_number": page_number,
                "blocks": blocks
            })

        if results and failed_pages == len(results):
            logging.warning("OCR failed on all pages for %s; returning partial response", pdf_path)

        try:
            tables = extract_tables(pdf_path)
        except Exception as exc:
            logging.warning("Table extraction failed for %s: %s", pdf_path, exc)
            tables = []

        try:
            images = extract_embedded_images(pdf_path)
        except Exception as exc:
            logging.warning("Image extraction failed for %s: %s", pdf_path, exc)
            images = []

        output = {
            "pages": results,
            "tables": tables,
            "images": images
        }

        return output
    finally:
        if request_dir:
            abs_request_dir = os.path.abspath(request_dir)
            abs_image_root = os.path.abspath(IMAGE_FOLDER)

            # Safety guard: never delete outside expected temp image folder.
            if abs_request_dir.startswith(abs_image_root):
                shutil.rmtree(request_dir, ignore_errors=True)

        # Remove root temp image folder too when empty so workspace stays clean.
        if os.path.isdir(IMAGE_FOLDER) and not os.listdir(IMAGE_FOLDER):
            os.rmdir(IMAGE_FOLDER)
