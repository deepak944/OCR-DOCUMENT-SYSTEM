# AI Service (FastAPI OCR)

This service processes uploaded PDF files and returns:
- text blocks per page
- detected tables
- extracted embedded images
- Word (`.docx`) conversion output

## Endpoints
- `GET /` -> health check
- `POST /process-document` -> OCR JSON (pages, tables, images)
- `POST /convert-pdf-to-word` -> Word file download

## Processing Pipeline
1. Extract native text blocks from PDF using `PyMuPDF`.
2. If a page has no native text, render page image and run `PaddleOCR` fallback.
3. Extract tables using `camelot`.
4. Extract embedded images from PDF using `PyMuPDF` image APIs.
5. For Word conversion, write text + tables + per-page images into `.docx`.

## Response Fields (`/process-document`)
- `pages`: list of `{ page_number, blocks[] }`
- `tables`: list of table dictionaries
- `images`: list of image metadata:
  - `page_number`
  - `image_index`
  - `xref`
  - `extension`
  - `mime_type`
  - `width`
  - `height`
  - `size_bytes`
  - `inline_preview_available`
  - `data_url` (nullable base64 preview)

## Core Libraries
- `fastapi`, `uvicorn`
- `paddleocr`, `paddlepaddle`
- `PyMuPDF`
- `camelot-py`
- `python-docx`
- `Pillow`

## Run Locally

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Example Requests
OCR:

```bash
curl -X POST "http://127.0.0.1:8000/process-document" ^
  -F "file=@C:/path/to/document.pdf" ^
  -H "accept: application/json"
```

Word conversion:

```bash
curl -X POST "http://127.0.0.1:8000/convert-pdf-to-word" ^
  -F "file=@C:/path/to/document.pdf" ^
  --output output.docx
```
