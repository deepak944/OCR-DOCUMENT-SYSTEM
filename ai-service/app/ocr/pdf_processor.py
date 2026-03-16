import fitz
import base64
import logging
import os
from pathlib import Path
from uuid import uuid4
from app.config import IMAGE_FOLDER

DEFAULT_MAX_INLINE_IMAGE_BYTES = 1_500_000


def convert_pdf_to_images(pdf_path):

    os.makedirs(IMAGE_FOLDER, exist_ok=True)

    pdf = fitz.open(pdf_path)

    request_folder = os.path.join(
        IMAGE_FOLDER,
        f"{Path(pdf_path).stem}_{uuid4().hex}"
    )
    os.makedirs(request_folder, exist_ok=True)

    images = []

    for page_number in range(len(pdf)):

        page = pdf.load_page(page_number)

        pix = page.get_pixmap(dpi=300)

        image_path = os.path.join(request_folder, f"page_{page_number + 1}.png")

        pix.save(image_path)

        images.append({
            "page_number": page_number + 1,
            "image_path": image_path
        })

    return images


def create_request_image_dir(pdf_path):
    os.makedirs(IMAGE_FOLDER, exist_ok=True)

    request_folder = os.path.join(
        IMAGE_FOLDER,
        f"{Path(pdf_path).stem}_{uuid4().hex}"
    )
    os.makedirs(request_folder, exist_ok=True)
    return request_folder


def convert_pdf_page_to_image(pdf_path, page_number, request_folder):
    pdf = fitz.open(pdf_path)

    try:
        page = pdf.load_page(page_number - 1)
        pix = page.get_pixmap(dpi=220)
        image_path = os.path.join(request_folder, f"page_{page_number}.png")
        pix.save(image_path)
        return image_path
    finally:
        pdf.close()


def _mime_type_from_extension(extension):
    ext = (extension or "").lower().lstrip(".")

    if ext in ("jpg", "jpeg", "jpe", "jfif"):
        return "image/jpeg"
    if ext == "png":
        return "image/png"
    if ext == "gif":
        return "image/gif"
    if ext in ("tif", "tiff"):
        return "image/tiff"
    if ext == "bmp":
        return "image/bmp"
    if ext == "webp":
        return "image/webp"

    return f"image/{ext}" if ext else "application/octet-stream"


def extract_embedded_images(pdf_path, max_inline_bytes=DEFAULT_MAX_INLINE_IMAGE_BYTES):
    document = fitz.open(pdf_path)
    extracted_images = []

    try:
        for page_index in range(len(document)):
            page = document.load_page(page_index)
            page_images = page.get_images(full=True)

            for image_index, image_info in enumerate(page_images, start=1):
                xref = image_info[0]

                try:
                    image_data = document.extract_image(xref)
                except Exception:
                    logging.exception(
                        "Failed to extract image xref=%s on page %s from %s",
                        xref,
                        page_index + 1,
                        pdf_path
                    )
                    continue

                raw_bytes = image_data.get("image")
                if not raw_bytes:
                    continue

                extension = (image_data.get("ext") or "png").lower().lstrip(".")
                mime_type = _mime_type_from_extension(extension)
                image_size = len(raw_bytes)

                image_entry = {
                    "page_number": page_index + 1,
                    "image_index": image_index,
                    "xref": xref,
                    "extension": extension,
                    "mime_type": mime_type,
                    "width": image_data.get("width"),
                    "height": image_data.get("height"),
                    "size_bytes": image_size,
                    "inline_preview_available": image_size <= max_inline_bytes,
                    "data_url": None
                }

                if image_size <= max_inline_bytes:
                    encoded_image = base64.b64encode(raw_bytes).decode("ascii")
                    image_entry["data_url"] = f"data:{mime_type};base64,{encoded_image}"

                extracted_images.append(image_entry)
    finally:
        document.close()

    return extracted_images
