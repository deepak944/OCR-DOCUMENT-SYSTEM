import os

# Work around Paddle oneDNN runtime errors on some CPU setups.
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from paddleocr import PaddleOCR
from app.config import OCR_LANGUAGE

ocr = PaddleOCR(
    use_angle_cls=True,
    lang=OCR_LANGUAGE,
    device="cpu",
    enable_hpi=False,
    enable_mkldnn=False,
    enable_cinn=False,
    cpu_threads=2
)


def run_ocr(image_path):

    result = ocr.ocr(image_path)

    blocks = []

    if not result:
        return blocks

    first_item = result[0] if isinstance(result, list) and result else None

    # PaddleOCR v3 style output (dict with arrays).
    if isinstance(first_item, dict):
        texts = first_item.get("rec_texts") or []
        scores = first_item.get("rec_scores") or []
        polys = first_item.get("dt_polys") or []

        for index, text in enumerate(texts):
            confidence = scores[index] if index < len(scores) else None
            bbox = polys[index] if index < len(polys) else None

            if hasattr(bbox, "tolist"):
                bbox = bbox.tolist()

            blocks.append({
                "text": text,
                "confidence": confidence,
                "bbox": bbox
            })

        return blocks

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
