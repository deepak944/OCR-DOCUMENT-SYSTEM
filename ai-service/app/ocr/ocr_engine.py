import os
import gc
import cv2
import json
import logging

# Work around Paddle oneDNN runtime errors on some CPU setups.
os.environ.setdefault("FLAGS_use_mkldnn", "0")

from paddleocr import PaddleOCR
from app.config import (
    OCR_LANGUAGE,
    OCR_CPU_THREADS,
    OCR_MAX_SIDE,
    OCR_ENABLE_PREPROCESSING,
    OCR_DET_MODEL,
)

_ocr_instance = None


def _get_ocr():
    global _ocr_instance

    if _ocr_instance is None:
        init_kwargs = dict(
            use_angle_cls=True,
            lang=OCR_LANGUAGE,
            device="cpu",
            enable_hpi=False,
            enable_mkldnn=False,
            enable_cinn=False,
            cpu_threads=max(1, OCR_CPU_THREADS),
            # Disable heavy pipeline steps that load extra models (UVDoc, PP-LCNet)
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
        )
        # Allow overriding the detection model to use a lighter variant.
        # Try both parameter names — newer PaddleOCR uses det_model_name,
        # older versions use det_model_dir or ignore unknown kwargs.
        if OCR_DET_MODEL:
            init_kwargs["det_model_name"] = OCR_DET_MODEL

        try:
            _ocr_instance = PaddleOCR(**init_kwargs)
        except TypeError:
            # Fallback: strip unsupported kwargs and retry
            for key in ("use_doc_orientation_classify", "use_doc_unwarping", "det_model_name"):
                init_kwargs.pop(key, None)
            _ocr_instance = PaddleOCR(**init_kwargs)

    return _ocr_instance


def _parse_ocr_result(result):
    blocks = []

    if not result:
        return blocks

    if isinstance(result, str):
        try:
            return _parse_ocr_result(json.loads(result))
        except json.JSONDecodeError:
            return blocks

    if isinstance(result, dict):
        result = [result]

    first_item = result[0] if isinstance(result, list) and result else None

    # PaddleOCR v3 style output (dict with arrays).
    if isinstance(first_item, dict):
        result_items = result if isinstance(result, list) else [first_item]

        for result_item in result_items:
            if not isinstance(result_item, dict):
                continue

            if isinstance(result_item.get("res"), dict):
                result_item = result_item["res"]

            texts = result_item.get("rec_texts") or []
            scores = result_item.get("rec_scores") or []
            polys = result_item.get("dt_polys") or result_item.get("rec_polys") or []

            for index, text in enumerate(texts):
                clean_text = str(text or "").strip()
                if not clean_text:
                    continue

                confidence = scores[index] if index < len(scores) else None
                bbox = polys[index] if index < len(polys) else None

                if hasattr(bbox, "tolist"):
                    bbox = bbox.tolist()

                blocks.append({
                    "text": clean_text,
                    "confidence": confidence,
                    "bbox": bbox
                })

        return blocks

    # PaddleOCR v3 Result objects can usually be converted to dicts.
    if hasattr(first_item, "json"):
        try:
            json_result = first_item.json() if callable(first_item.json) else first_item.json
            return _parse_ocr_result(json_result)
        except Exception:
            logging.exception("Failed to parse PaddleOCR JSON result")

    if hasattr(first_item, "dict"):
        try:
            dict_result = first_item.dict() if callable(first_item.dict) else first_item.dict
            return _parse_ocr_result(dict_result)
        except Exception:
            logging.exception("Failed to parse PaddleOCR dict result")

    if hasattr(first_item, "to_dict"):
        try:
            dict_result = first_item.to_dict() if callable(first_item.to_dict) else first_item.to_dict
            return _parse_ocr_result(dict_result)
        except Exception:
            logging.exception("Failed to parse PaddleOCR to_dict result")

    # PaddleOCR v2 style output ([[bbox, [text, confidence]], ...]).
    if first_item:
        for line in first_item:
            if not isinstance(line, (list, tuple)) or len(line) < 2:
                continue

            bbox = line[0]
            text_data = line[1]

            if not isinstance(text_data, (list, tuple)) or len(text_data) < 2:
                continue

            blocks.append({
                "text": text_data[0],
                "confidence": text_data[1],
                "bbox": bbox
            })

    return blocks


def _text_signal_score(blocks):
    joined_text = " ".join(
        (str(block.get("text", "")).strip() for block in blocks if isinstance(block, dict))
    )
    return sum(1 for char in joined_text if char.isalnum())


def _resize_image_for_ocr(image_path):
    image = cv2.imread(image_path)
    if image is None:
        return None

    height, width = image.shape[:2]
    longest_side = max(height, width)

    if longest_side <= OCR_MAX_SIDE:
        return None

    resize_ratio = OCR_MAX_SIDE / float(longest_side)
    resized = cv2.resize(
        image,
        None,
        fx=resize_ratio,
        fy=resize_ratio,
        interpolation=cv2.INTER_AREA
    )

    resized_path = f"{os.path.splitext(image_path)[0]}_scaled.png"
    cv2.imwrite(resized_path, resized)
    return resized_path


def _prepare_image_for_ocr(image_path):
    image = cv2.imread(image_path)
    if image is None:
        return None

    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = grayscale.shape

    # Slight upscale for very small scans, while keeping memory usage controlled.
    if max(height, width) < 1800:
        grayscale = cv2.resize(
            grayscale,
            None,
            fx=1.3,
            fy=1.3,
            interpolation=cv2.INTER_CUBIC
        )

    denoised = cv2.fastNlMeansDenoising(grayscale, None, 15, 7, 21)
    thresholded = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15
    )

    processed_path = f"{os.path.splitext(image_path)[0]}_ocrprep.png"
    cv2.imwrite(processed_path, thresholded)
    return processed_path


def _run_ocr_compat(image_path):
    # PaddleOCR API differs across versions; some versions reject cls=...
    ocr = _get_ocr()

    try:
        return ocr.ocr(image_path, cls=True)
    except TypeError as exc:
        if "unexpected keyword argument 'cls'" in str(exc):
            return ocr.ocr(image_path)
        raise


def run_ocr(image_path):
    temporary_files = []
    primary_image_path = image_path

    try:
        try:
            resized_image_path = _resize_image_for_ocr(image_path)
            if resized_image_path:
                primary_image_path = resized_image_path
                temporary_files.append(resized_image_path)
        except Exception:
            logging.exception("Image resize step failed for OCR on %s", image_path)

        result = _run_ocr_compat(primary_image_path)
        primary_blocks = _parse_ocr_result(result)

        if not OCR_ENABLE_PREPROCESSING:
            return primary_blocks

        prepared_image_path = None
        try:
            prepared_image_path = _prepare_image_for_ocr(primary_image_path)
            if prepared_image_path:
                temporary_files.append(prepared_image_path)
        except Exception:
            logging.exception("Image preprocessing failed for OCR on %s", primary_image_path)

        if not prepared_image_path:
            return primary_blocks

        prepared_result = _run_ocr_compat(prepared_image_path)
        prepared_blocks = _parse_ocr_result(prepared_result)

        if _text_signal_score(prepared_blocks) > _text_signal_score(primary_blocks):
            return prepared_blocks

        return primary_blocks
    except Exception:
        logging.exception("OCR failed for image %s", primary_image_path)
        return []
    finally:
        for temp_path in temporary_files:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        gc.collect()
