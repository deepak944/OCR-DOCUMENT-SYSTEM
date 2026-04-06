# AI Service

The AI service is a FastAPI OCR microservice that processes digital and scanned PDFs, extracts structured content, and generates Word output.

## Stack

- FastAPI
- Uvicorn
- PaddleOCR
- PaddlePaddle
- PyMuPDF
- Camelot
- python-docx
- Pillow

## What It Does

- reads digital PDF text with PyMuPDF
- renders scanned pages and runs PaddleOCR
- extracts text blocks per page
- detects tables
- extracts embedded images
- returns structured OCR JSON
- converts a PDF into a Word document

## OCR Flow

1. Receive uploaded PDF.
2. Open the PDF page by page.
3. Try native text extraction first.
4. If the page is scanned or text is missing, render the page as an image.
5. Run PaddleOCR on the rendered image.
6. Extract tables using the table parser.
7. Extract embedded images and lightweight previews.
8. Return one structured response for the backend.

## API Endpoints

### `GET /`

Health check.

### `POST /process-document`

Accepts a PDF file and returns structured OCR JSON.

Example response shape:

```json
{
  "pages": [
    {
      "page_number": 1,
      "text": "Extracted page text",
      "blocks": [
        {
          "text": "Block text"
        }
      ],
      "tables": [],
      "metadata": {}
    }
  ],
  "tables": [],
  "images": []
}
```

### `POST /convert-pdf-to-word`

Accepts a PDF file and returns a generated `.docx` file.

## Main Modules

- `app/main.py`
- `app/config.py`
- `app/services/document_services.py`
- `app/services/word_export_service.py`
- `app/ocr/ocr_engine.py`
- `app/ocr/pdf_processor.py`
- `app/ocr/native_text_extractor.py`
- `app/ocr/table_parser.py`

## Run Locally

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Runtime Notes

- The Docker image installs Ghostscript and Poppler tools required by Camelot and PDF processing.
- Paddle model source checking is left enabled in the current Docker flow.
- OCR-related behavior can be tuned with environment variables in `docker-compose.yml`:
  - `OCR_CPU_THREADS`
  - `OCR_FALLBACK_DPI`
  - `OCR_MAX_SIDE`
  - `OCR_ENABLE_PREPROCESSING`
  - `OCR_DET_MODEL`

## Example Requests

OCR:

```bash
curl -X POST "http://127.0.0.1:8000/process-document" \
  -F "file=@/path/to/document.pdf"
```

Word:

```bash
curl -X POST "http://127.0.0.1:8000/convert-pdf-to-word" \
  -F "file=@/path/to/document.pdf" \
  --output output.docx
```
