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
import numpy as np

# --- Thresholds ---
# A page must have fewer than these to trigger OCR fallback.
# Raised from 12/60 to avoid unnecessary OCR on text-heavy PDFs.
MIN_NATIVE_WORDS_FOR_SKIP_OCR = 30
MIN_NATIVE_ALNUM_CHARS_FOR_SKIP_OCR = 150
OCR_REPLACEMENT_RATIO = 1.2

# Large-PDF limits — above these, skip slow operations entirely.
# A 200-page PDF with good native text should never need OCR or Camelot.
MAX_PAGES_FOR_CAMELOT = 50        # Camelot is very slow on large PDFs
MAX_PAGES_FOR_EMBEDDED_IMAGES = 30  # base64-encoding every image is expensive
MAX_PAGES_FOR_OCR = 100           # Don't OCR more than this many pages total
MAX_FILE_BYTES_FOR_CAMELOT = 30 * 1024 * 1024   # 30 MB


def _clean_numpy_types(obj):
    """Recursively converts numpy types to native Python types so FastAPI can serialize them."""
    if isinstance(obj, dict):
        return {k: _clean_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_clean_numpy_types(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(_clean_numpy_types(v) for v in obj)
    elif isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                          np.int16, np.int32, np.int64, np.uint8,
                          np.uint16, np.uint32, np.uint64)):
        return int(obj)
    elif isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return _clean_numpy_types(obj.tolist())
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def _text_signal(blocks):
    joined_text = " ".join(
        str(block.get("text", "")).strip()
        for block in (blocks or [])
        if isinstance(block, dict)
    )
    words = re.findall(r"\w+", joined_text)
    alnum_chars = sum(1 for char in joined_text if char.isalnum())
    return {"words": len(words), "alnum_chars": alnum_chars}


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


def _page_text(blocks):
    return "\n".join(
        str(block.get("text", "")).strip()
        for block in (blocks or [])
        if isinstance(block, dict) and str(block.get("text", "")).strip()
    )


def _tables_by_page(tables):
    grouped = {}
    for table in tables or []:
        page_number = table.get("page_number") if isinstance(table, dict) else None
        if page_number is None:
            continue
        grouped.setdefault(page_number, []).append(table)
    return grouped


def _images_by_page(images):
    grouped = {}
    for image in images or []:
        page_number = image.get("page_number") if isinstance(image, dict) else None
        if page_number is None:
            continue
        grouped.setdefault(page_number, []).append(image)
    return grouped


def _is_large_pdf(pdf_path, page_count):
    """Returns True if the PDF is large enough to skip slow operations."""
    try:
        file_bytes = os.path.getsize(pdf_path)
    except OSError:
        file_bytes = 0
    return page_count > MAX_PAGES_FOR_CAMELOT or file_bytes > MAX_FILE_BYTES_FOR_CAMELOT


def process_document(pdf_path):
    pages = extract_pdf_text_blocks(pdf_path)
    page_count = len(pages)
    request_dir = None
    results = []
    failed_pages = 0
    ocr_page_count = 0

    large_pdf = _is_large_pdf(pdf_path, page_count)
    if large_pdf:
        logging.info(
            "Large PDF detected (%d pages) — skipping Camelot and embedded image extraction",
            page_count
        )

    try:
        for page in pages:
            page_number = page["page_number"]
            native_blocks = page["blocks"]
            blocks = native_blocks

            # Skip OCR entirely once we've hit the per-document OCR page cap.
            # For large PDFs with good native text, this is almost never triggered.
            ocr_allowed = ocr_page_count < MAX_PAGES_FOR_OCR

            if ocr_allowed and _should_try_ocr(native_blocks):
                image_path = None
                try:
                    if request_dir is None:
                        request_dir = create_request_image_dir(pdf_path)

                    image_path = convert_pdf_page_to_image(pdf_path, page_number, request_dir)
                    ocr_blocks = run_ocr(image_path)
                    blocks = _prefer_ocr_blocks(native_blocks, ocr_blocks)
                    ocr_page_count += 1
                except Exception:
                    logging.exception("OCR failed for page %s in %s", page_number, pdf_path)
                    blocks = native_blocks
                    failed_pages += 1
                finally:
                    if image_path and os.path.exists(image_path):
                        try:
                            os.remove(image_path)
                        except OSError:
                            pass
                    gc.collect()

            results.append({"page_number": page_number, "blocks": blocks})

        if results and failed_pages == len(results):
            logging.warning("OCR failed on all pages for %s; returning partial response", pdf_path)

        # Table extraction — skip Camelot for large PDFs, use OCR-block heuristic only
        try:
            if large_pdf:
                from app.ocr.table_parser import _extract_tables_from_ocr_blocks
                tables = []
                for page in results:
                    tables.extend(
                        _extract_tables_from_ocr_blocks(page["page_number"], page["blocks"])
                    )
                tables.sort(key=lambda t: (t.get("page_number") or 0, t.get("id") or ""))
            else:
                tables = extract_tables(pdf_path, results)
        except Exception as exc:
            logging.warning("Table extraction failed for %s: %s", pdf_path, exc)
            tables = []

        # Embedded image extraction — skip for large PDFs (too slow, too much memory)
        try:
            if large_pdf or page_count > MAX_PAGES_FOR_EMBEDDED_IMAGES:
                images = []
            else:
                images = extract_embedded_images(pdf_path)
        except Exception as exc:
            logging.warning("Image extraction failed for %s: %s", pdf_path, exc)
            images = []

        page_tables = _tables_by_page(tables)
        page_images = _images_by_page(images)

        enriched_pages = []
        for page in results:
            page_number = page["page_number"]
            blocks = page["blocks"]
            text = _page_text(blocks)
            current_tables = page_tables.get(page_number, [])
            current_images = page_images.get(page_number, [])

            enriched_pages.append({
                "page_number": page_number,
                "text": text,
                "blocks": blocks,
                "tables": current_tables,
                "metadata": {
                    "block_count": len(blocks),
                    "table_count": len(current_tables),
                    "image_count": len(current_images),
                    "text_length": len(text),
                }
            })

        final_result = {
            "pages": enriched_pages,
            "tables": tables,
            "images": images,
            "metadata": {
                "page_count": len(enriched_pages),
                "table_count": len(tables),
                "image_count": len(images),
                "ocr_failed_pages": failed_pages,
                "ocr_pages_processed": ocr_page_count,
                "large_pdf": large_pdf,
            }
        }
        
        return _clean_numpy_types(final_result)

    finally:
        if request_dir:
            abs_request_dir = os.path.abspath(request_dir)
            abs_image_root = os.path.abspath(IMAGE_FOLDER)
            if abs_request_dir.startswith(abs_image_root):
                shutil.rmtree(request_dir, ignore_errors=True)

        if os.path.isdir(IMAGE_FOLDER) and not os.listdir(IMAGE_FOLDER):
            os.rmdir(IMAGE_FOLDER)
