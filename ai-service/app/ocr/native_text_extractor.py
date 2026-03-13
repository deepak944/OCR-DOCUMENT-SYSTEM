import fitz


def extract_pdf_text_blocks(pdf_path):
    document = fitz.open(pdf_path)
    pages = []

    try:
        for page_index in range(len(document)):
            page = document.load_page(page_index)
            raw_blocks = page.get_text("blocks")
            blocks = []

            for block in raw_blocks:
                if len(block) < 5:
                    continue

                x0, y0, x1, y1, text = block[:5]
                clean_text = (text or "").strip()

                if not clean_text:
                    continue

                blocks.append({
                    "text": clean_text,
                    "confidence": 1.0,
                    "bbox": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
                })

            pages.append({
                "page_number": page_index + 1,
                "blocks": blocks
            })
    finally:
        document.close()

    return pages
