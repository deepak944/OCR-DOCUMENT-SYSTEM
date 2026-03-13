import base64
import fitz


def convert_pdf_to_word_doc(pdf_path, output_doc_path):
    pdf = fitz.open(pdf_path)

    page_sections = []

    for index in range(len(pdf)):
        page = pdf.load_page(index)
        pix = page.get_pixmap(dpi=200, alpha=False)
        image_bytes = pix.tobytes("png")
        image_base64 = base64.b64encode(image_bytes).decode("ascii")

        page_sections.append(
            f"""
            <section style="margin-bottom: 18px;">
              <h2 style="font-size: 18px; margin: 0 0 8px;">Page {index + 1}</h2>
              <img src="data:image/png;base64,{image_base64}" style="width: 100%; max-width: 750px; border: 1px solid #ddd;" />
            </section>
            """
        )

    html_doc = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Converted PDF</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 22px;">
        <h1 style="margin-bottom: 14px;">PDF to Word Conversion</h1>
        {"".join(page_sections)}
      </body>
    </html>
    """

    with open(output_doc_path, "wb") as document_file:
        document_file.write("\ufeff".encode("utf-8"))
        document_file.write(html_doc.encode("utf-8"))

    return output_doc_path

