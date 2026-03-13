import camelot
import logging


def extract_tables(pdf_path):
    try:
        tables = camelot.read_pdf(pdf_path, pages="all")

        table_data = []

        for table in tables:
            table_data.append(table.df.to_dict())

        return table_data

    except Exception as exc:
        logging.warning("extract_tables failed for %s: %s", pdf_path, exc)
        # Return empty table list so the endpoint remains responsive
        return []