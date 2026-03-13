# OCR Document System

## OCR FastAPI Service (ai-service)

### Architecture overview

- **API layer**: `ai-service/app/main.py`
  - FastAPI app with:
    - `GET /` health check
    - `POST /process-document`: accepts PDF upload, validates, stores, processes
- **Configuration**: `ai-service/app/config.py`
  - `UPLOAD_FOLDER`: `uploads`
  - `IMAGE_FOLDER`: `temp_imagess`
  - `OCR_LANGUAGE`: `en`
- **Orchestration**: `ai-service/app/services/document_services.py`
  - `convert_pdf_to_images(pdf_path)`
  - `run_ocr(image_path)` per page
  - `extract_tables(pdf_path)`
  - returns:
    - `pages: [{page_number, blocks}, ...]`
    - `tables: [ ... ]`
- **OCR engine**: `ai-service/app/ocr/ocr_engine.py`
  - PaddleOCR (`paddleocr.PaddleOCR`)
  - returns text blocks with bbox + confidence
- **PDF to image**: `ai-service/app/ocr/pdf_processor.py`
  - PyMuPDF (`fitz`)
  - saves PNG files to `temp_imagess`
- **Table parsing**: `ai-service/app/ocr/table_parser.py`
  - camelot (`camelot.read_pdf`)
  - table -> `table.df.to_dict()`

### Data flow

1. Client uploads PDF to `/process-document`
2. File saved in `uploads/`
3. Convert PDF pages to images
4. OCR each image page
5. Extract tables from PDF
6. Return structured JSON:
   - `{"pages": [...], "tables": [...]}`

### Dependencies (core)

- `fastapi`, `uvicorn`
- `paddleocr`, `paddlepaddle`
- `PyMuPDF`, `camelot-py`
- `opencv-python-headless`, `Pillow`
- `pandas`, `numpy`

### Notes

- Partial failure handling:
  - page OCR failure logs warning; continue processing
  - table parse failure returns empty list
- Cleanup and filename collision controls are not implemented

## Run locally

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Example request

```bash
curl -X POST "http://127.0.0.1:8000/process-document" -F "file=@/path/to/document.pdf" -H "accept: application/json"
```
