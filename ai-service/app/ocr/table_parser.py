import logging
from statistics import median

import camelot


def _safe_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_text(value):
    return " ".join(str(value or "").split())


def _normalize_rows(rows):
    cleaned_rows = []

    for row in rows or []:
        normalized = [_normalize_text(cell) for cell in row]
        cleaned_rows.append(normalized)

    while cleaned_rows and not any(cleaned_rows[0]):
        cleaned_rows.pop(0)

    while cleaned_rows and not any(cleaned_rows[-1]):
        cleaned_rows.pop()

    if not cleaned_rows:
        return []

    max_columns = max(len(row) for row in cleaned_rows)
    padded_rows = [row + [""] * (max_columns - len(row)) for row in cleaned_rows]

    keep_columns = [
        index
        for index in range(max_columns)
        if any(_normalize_text(row[index]) for row in padded_rows)
    ]

    return [[row[index] for index in keep_columns] for row in padded_rows] if keep_columns else []


def _bbox_points(block):
    bbox = block.get("bbox") if isinstance(block, dict) else None
    if not isinstance(bbox, list):
        return None

    if bbox and isinstance(bbox[0], (list, tuple)) and len(bbox[0]) >= 2:
        return bbox

    if len(bbox) >= 4:
        x0, y0, x1, y1 = bbox[:4]
        return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

    return None


def _rect_from_block(block):
    points = _bbox_points(block)
    if not points:
        return None

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return {
        "x0": min(xs),
        "y0": min(ys),
        "x1": max(xs),
        "y1": max(ys),
    }


def _annotate_block(block):
    rect = _rect_from_block(block)
    if not rect:
      return None

    text = _normalize_text(block.get("text"))
    if not text:
        return None

    return {
        "text": text,
        "rect": rect,
        "x_center": (rect["x0"] + rect["x1"]) / 2.0,
        "y_center": (rect["y0"] + rect["y1"]) / 2.0,
        "width": max(1.0, rect["x1"] - rect["x0"]),
        "height": max(1.0, rect["y1"] - rect["y0"]),
    }


def _row_threshold(blocks):
    heights = [block["height"] for block in blocks if block.get("height")]
    if not heights:
        return 14.0
    return max(10.0, min(24.0, median(heights) * 0.8))


def _group_blocks_into_rows(blocks):
    annotated = [_annotate_block(block) for block in blocks or []]
    annotated = [block for block in annotated if block]
    annotated.sort(key=lambda block: (block["rect"]["y0"], block["rect"]["x0"]))

    if not annotated:
        return []

    threshold = _row_threshold(annotated)
    rows = []

    for block in annotated:
        if not rows:
            rows.append({"blocks": [block], "center_y": block["y_center"]})
            continue

        last_row = rows[-1]
        if abs(block["y_center"] - last_row["center_y"]) <= threshold:
            last_row["blocks"].append(block)
            last_row["center_y"] = sum(item["y_center"] for item in last_row["blocks"]) / len(last_row["blocks"])
        else:
            rows.append({"blocks": [block], "center_y": block["y_center"]})

    for row in rows:
        row["blocks"].sort(key=lambda block: block["rect"]["x0"])

    return rows


def _split_candidate_row_groups(rows):
    candidate_rows = [row for row in rows if len(row["blocks"]) >= 2]
    if len(candidate_rows) < 2:
        return []

    groups = []
    current_group = [candidate_rows[0]]

    for row in candidate_rows[1:]:
        previous_row = current_group[-1]
        previous_bottom = max(block["rect"]["y1"] for block in previous_row["blocks"])
        current_top = min(block["rect"]["y0"] for block in row["blocks"])
        gap = current_top - previous_bottom
        threshold = _row_threshold(previous_row["blocks"] + row["blocks"]) * 1.6

        if gap > threshold:
            if len(current_group) >= 2:
                groups.append(current_group)
            current_group = [row]
        else:
            current_group.append(row)

    if len(current_group) >= 2:
        groups.append(current_group)

    return groups


def _cluster_columns(blocks):
    sorted_blocks = sorted(blocks, key=lambda block: block["x_center"])
    if not sorted_blocks:
        return []

    widths = [block["width"] for block in sorted_blocks if block.get("width")]
    threshold = max(18.0, min(60.0, median(widths) * 0.65 if widths else 24.0))
    columns = [{"center_x": sorted_blocks[0]["x_center"], "blocks": [sorted_blocks[0]]}]

    for block in sorted_blocks[1:]:
        if abs(block["x_center"] - columns[-1]["center_x"]) <= threshold:
            columns[-1]["blocks"].append(block)
            columns[-1]["center_x"] = sum(item["x_center"] for item in columns[-1]["blocks"]) / len(columns[-1]["blocks"])
        else:
            columns.append({"center_x": block["x_center"], "blocks": [block]})

    return columns


def _rows_from_row_group(row_group):
    all_blocks = [block for row in row_group for block in row["blocks"]]
    columns = _cluster_columns(all_blocks)
    if len(columns) < 2:
        return []

    rows = []

    for row in row_group:
        cells = [""] * len(columns)
        for block in row["blocks"]:
            distances = [abs(block["x_center"] - column["center_x"]) for column in columns]
            column_index = distances.index(min(distances))
            if cells[column_index]:
                cells[column_index] = f"{cells[column_index]} {block['text']}".strip()
            else:
                cells[column_index] = block["text"]
        rows.append(cells)

    normalized_rows = _normalize_rows(rows)
    non_empty_cells = sum(1 for row in normalized_rows for cell in row if cell)

    if len(normalized_rows) < 2:
        return []

    if len(normalized_rows[0]) < 2 or non_empty_cells < 4:
        return []

    return normalized_rows


def _bbox_from_group(row_group):
    all_blocks = [block for row in row_group for block in row["blocks"]]
    return {
        "x0": min(block["rect"]["x0"] for block in all_blocks),
        "y0": min(block["rect"]["y0"] for block in all_blocks),
        "x1": max(block["rect"]["x1"] for block in all_blocks),
        "y1": max(block["rect"]["y1"] for block in all_blocks),
    }


def _build_structured_table(page_number, rows, source, table_index, bbox=None):
    normalized_rows = _normalize_rows(rows)
    if len(normalized_rows) < 1:
        return None

    return {
        "id": f"page-{page_number}-table-{table_index}",
        "page_number": page_number,
        "source": source,
        "row_count": len(normalized_rows),
        "column_count": max((len(row) for row in normalized_rows), default=0),
        "bbox": bbox,
        "header": normalized_rows[0] if normalized_rows else [],
        "rows": normalized_rows,
    }


def _extract_tables_from_ocr_blocks(page_number, blocks):
    rows = _group_blocks_into_rows(blocks)
    groups = _split_candidate_row_groups(rows)
    tables = []

    for table_index, group in enumerate(groups, start=1):
        table_rows = _rows_from_row_group(group)
        if not table_rows:
            continue

        table = _build_structured_table(
            page_number=page_number,
            rows=table_rows,
            source="ocr",
            table_index=table_index,
            bbox=_bbox_from_group(group),
        )
        if table:
            tables.append(table)

    return tables


def _camelot_rows(table):
    try:
        return _normalize_rows(table.df.values.tolist())
    except Exception:
        return []


def extract_tables(pdf_path, ocr_pages=None):
    structured_tables = []
    detected_pages = set()

    try:
        native_tables = camelot.read_pdf(pdf_path, pages="all", flavor="stream")

        for table_index, table in enumerate(native_tables, start=1):
            page_number = _safe_int(str(table.page).split(",")[0])
            rows = _camelot_rows(table)

            if page_number is None or len(rows) < 2:
                continue

            structured_table = _build_structured_table(
                page_number=page_number,
                rows=rows,
                source="camelot",
                table_index=table_index,
                bbox=None,
            )
            if structured_table:
                structured_tables.append(structured_table)
                detected_pages.add(page_number)

    except Exception as exc:
        logging.warning("extract_tables failed for %s: %s", pdf_path, exc)

    for page in ocr_pages or []:
        page_number = page.get("page_number")
        if page_number in detected_pages:
            continue

        inferred_tables = _extract_tables_from_ocr_blocks(page_number, page.get("blocks", []))
        structured_tables.extend(inferred_tables)

    structured_tables.sort(key=lambda table: (table.get("page_number") or 0, table.get("id") or ""))
    return structured_tables
