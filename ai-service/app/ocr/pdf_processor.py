import fitz
import os
from pathlib import Path
from uuid import uuid4
from app.config import IMAGE_FOLDER


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
