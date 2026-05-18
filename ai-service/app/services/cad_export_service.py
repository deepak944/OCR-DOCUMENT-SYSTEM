import ezdxf
import os
import logging
from pathlib import Path
from uuid import uuid4

def convert_extracted_data_to_cad(document_data, output_path):
    """
    Converts OCR extracted data (text and tables) into an AutoCAD DXF file.
    Organizes the data into layers (PAGE_BORDERS, OCR_TEXT, TABLES, TABLE_TEXT)
    and arranges multiple pages horizontally.
    """
    try:
        # Create a new DXF R2010 drawing
        doc = ezdxf.new('R2010')
        msp = doc.modelspace()

        # Set up layers with distinct colors
        # Color codes: 8 = Dark Gray (borders), 7 = White/Black (text), 1 = Red (tables), 3 = Green (table text)
        doc.layers.add('PAGE_BORDERS', color=8)
        doc.layers.add('OCR_TEXT', color=7)
        doc.layers.add('TABLES', color=1)
        doc.layers.add('TABLE_TEXT', color=3)

        pages = document_data.get("pages", [])
        
        # Standard page dimensions (A4 point scale: ~595 width, ~842 height)
        page_width = 595.0
        page_height = 842.0
        gap = 150.0 # horizontal gap between pages in CAD workspace

        for page in pages:
            page_number = page.get("page_number", 1)
            blocks = page.get("blocks", [])
            tables = page.get("tables", [])

            # Horizontal offset to place pages side-by-side
            x_offset = (page_number - 1) * (page_width + gap)

            # 1. Draw Page Border
            border_points = [
                (x_offset, 0.0),
                (x_offset + page_width, 0.0),
                (x_offset + page_width, page_height),
                (x_offset, page_height)
            ]
            msp.add_lwpolyline(border_points, format='xy', close=True, dxfattribs={'layer': 'PAGE_BORDERS'})

            # Add page title text above the border
            title_pos = (x_offset + 10.0, page_height + 15.0)
            msp.add_text(
                f"PAGE {page_number}",
                dxfattribs={'layer': 'PAGE_BORDERS', 'height': 15.0, 'insert': title_pos}
            )



            # 2. Draw OCR Text Blocks
            for block in blocks:
                text = str(block.get("text", "")).strip()
                if not text:
                    continue

                bbox = block.get("bbox")
                if not bbox or not isinstance(bbox, list) or len(bbox) < 4:
                    continue

                try:
                    # Bounding box points extraction
                    xs = [float(pt[0]) for pt in bbox]
                    ys = [float(pt[1]) for pt in bbox]
                    
                    x0 = min(xs) + x_offset
                    x1 = max(xs) + x_offset
                    y0_pdf = min(ys)
                    y1_pdf = max(ys)

                    # Invert Y-axis: PDF origin is top-left, DXF origin is bottom-left
                    y0 = page_height - y1_pdf
                    y1 = page_height - y0_pdf

                    block_height = max(1.0, y1 - y0)
                    text_size = max(5.0, min(14.0, block_height * 0.8))

                    # Create multi-line text (MTEXT) which flows beautifully inside boundaries
                    mtext = msp.add_mtext(text, dxfattribs={'layer': 'OCR_TEXT'})
                    mtext.dxf.char_height = text_size
                    mtext.dxf.insert = (x0, y1) # Position at the top-left of the CAD text boundary
                    mtext.dxf.width = max(10.0, x1 - x0)
                except Exception as e:
                    logging.warning(f"Failed to write text block '{text}' to DXF: {e}")

            # 3. Draw Tables
            for table_idx, table in enumerate(tables, start=1):
                rows = table.get("rows", [])
                if not rows:
                    continue

                num_rows = len(rows)
                num_cols = max(len(r) for r in rows) if rows else 0
                if num_rows == 0 or num_cols == 0:
                    continue

                # Estimate boundaries for the table
                bbox = table.get("bbox")
                if bbox and isinstance(bbox, dict) and "x0" in bbox:
                    t_x0 = float(bbox["x0"]) + x_offset
                    t_x1 = float(bbox["x1"]) + x_offset
                    t_y0 = page_height - float(bbox["y1"])
                    t_y1 = page_height - float(bbox["y0"])
                else:
                    # Fallback default position in the lower/middle section of the page
                    t_x0 = x_offset + 50.0
                    t_x1 = x_offset + page_width - 50.0
                    t_y1 = page_height - 150.0 - (table_idx * 150.0)
                    t_y0 = t_y1 - (num_rows * 20.0)

                t_width = max(20.0, t_x1 - t_x0)
                t_height = max(15.0, t_y1 - t_y0)

                row_height = t_height / num_rows
                col_width = t_width / num_cols

                # Draw horizontal grid lines
                for i in range(num_rows + 1):
                    curr_y = t_y1 - (i * row_height)
                    msp.add_line((t_x0, curr_y), (t_x1, curr_y), dxfattribs={'layer': 'TABLES'})

                # Draw vertical grid lines
                for j in range(num_cols + 1):
                    curr_x = t_x0 + (j * col_width)
                    msp.add_line((curr_x, t_y0), (curr_x, t_y1), dxfattribs={'layer': 'TABLES'})

                # Draw table text inside grid cells
                for r_idx, row in enumerate(rows):
                    for c_idx, cell_value in enumerate(row):
                        cell_text = str(cell_value or "").strip()
                        if not cell_text:
                            continue

                        # Calculate center bounding box of the cell
                        c_x0 = t_x0 + (c_idx * col_width)
                        c_x1 = c_x0 + col_width
                        c_y1 = t_y1 - (r_idx * row_height)
                        c_y0 = c_y1 - row_height

                        # Pad slightly and write centered MTEXT inside the cell
                        cell_mtext = msp.add_mtext(cell_text, dxfattribs={'layer': 'TABLE_TEXT'})
                        cell_mtext.dxf.char_height = max(4.0, min(10.0, row_height * 0.5))
                        cell_mtext.dxf.insert = (c_x0 + 2.0, c_y1 - 2.0)
                        cell_mtext.dxf.width = max(5.0, col_width - 4.0)

        # Save drawing to output path
        doc.saveas(output_path)
        logging.info(f"AutoCAD DXF generated successfully at {output_path}")
        return True
    except Exception as e:
        logging.exception(f"Error converting document data to CAD: {e}")
        raise e
