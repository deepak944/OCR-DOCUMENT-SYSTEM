from docx import Document

from app.services.document_services import process_document


def _safe_sort_key(value):
    try:
        return (0, int(value))
    except (TypeError, ValueError):
        return (1, str(value))


def _normalize_text(value):
    lines = [line.strip() for line in str(value or "").splitlines() if line.strip()]
    return " ".join(lines)


def _bbox_sort_key(block):
    bbox = block.get("bbox") if isinstance(block, dict) else None

    if isinstance(bbox, list):
        if bbox and isinstance(bbox[0], (list, tuple)) and len(bbox[0]) >= 2:
            try:
                x, y = bbox[0][0], bbox[0][1]
                return (float(y), float(x))
            except (TypeError, ValueError):
                pass

        if len(bbox) >= 2:
            try:
                x, y = bbox[0], bbox[1]
                return (float(y), float(x))
            except (TypeError, ValueError):
                pass

    return (float("inf"), float("inf"))


def _table_dict_to_rows(table_dict):
    if not isinstance(table_dict, dict):
        return []

    columns = []
    for column_key, row_map in table_dict.items():
        if isinstance(row_map, dict):
            columns.append((column_key, row_map))

    if not columns:
        return []

    ordered_columns = [col for col, _ in sorted(columns, key=lambda item: _safe_sort_key(item[0]))]
    row_keys = set()
    for _, row_map in columns:
        row_keys.update(row_map.keys())

    ordered_rows = sorted(row_keys, key=_safe_sort_key)
    rows = []

    for row_key in ordered_rows:
        row_values = []
        for column_key in ordered_columns:
            raw_value = table_dict.get(column_key, {}).get(row_key, "")
            row_values.append(_normalize_text(raw_value))
        rows.append(row_values)

    return rows


def _append_tables(document, tables):
    table_count = 0

    for table_data in tables:
        rows = _table_dict_to_rows(table_data)
        if not rows:
            continue

        if table_count == 0:
            document.add_heading("Extracted Tables", level=1)

        table_count += 1
        document.add_paragraph(f"Table {table_count}")

        doc_table = document.add_table(rows=len(rows), cols=len(rows[0]))
        doc_table.style = "Table Grid"

        for row_index, row in enumerate(rows):
            for col_index, value in enumerate(row):
                doc_table.cell(row_index, col_index).text = value


def convert_pdf_to_word_doc(pdf_path, output_doc_path):
    extracted = process_document(pdf_path)
    pages = extracted.get("pages", [])
    tables = extracted.get("tables", [])

    document = Document()
    document.add_heading("PDF to Word Conversion", level=0)

    if not pages:
        document.add_paragraph("No text could be extracted from the uploaded PDF.")

    for page in pages:
        page_number = page.get("page_number")
        page_label = page_number if page_number is not None else "Unknown"
        document.add_heading(f"Page {page_label}", level=1)

        blocks = sorted(page.get("blocks", []), key=_bbox_sort_key)
        has_text = False

        for block in blocks:
            text = _normalize_text(block.get("text", ""))
            if not text:
                continue

            document.add_paragraph(text)
            has_text = True

        if not has_text:
            document.add_paragraph("No text detected on this page.")

    _append_tables(document, tables)

    document.save(output_doc_path)
    return output_doc_path
