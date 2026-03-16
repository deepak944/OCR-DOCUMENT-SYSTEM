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
import os
import shutil


def process_document(pdf_path):
    pages = extract_pdf_text_blocks(pdf_path)
    request_dir = None
    results = []
    failed_pages = 0

    try:
        for page in pages:
            page_number = page["page_number"]
            blocks = page["blocks"]

            if not blocks:
                try:
                    if request_dir is None:
                        request_dir = create_request_image_dir(pdf_path)

                    image_path = convert_pdf_page_to_image(pdf_path, page_number, request_dir)
                    blocks = run_ocr(image_path)
                except Exception:
                    logging.exception("OCR failed for page %s in %s", page_number, pdf_path)
                    blocks = []
                    failed_pages += 1

            results.append({
                "page_number": page_number,
                "blocks": blocks
            })

        if results and failed_pages == len(results):
            raise RuntimeError("OCR failed on all pages")

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
