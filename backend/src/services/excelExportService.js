const ExcelJS = require("exceljs");

function sanitizeSheetName(name, fallback) {
  const cleaned = String(name || fallback || "Sheet")
    .replace(/[\\/*?:[\]]/g, " ")
    .trim()
    .slice(0, 31);

  return cleaned || fallback || "Sheet";
}

function toSortedKeys(values) {
  return Object.keys(values || {}).sort((left, right) => Number(left) - Number(right));
}

function tableObjectToRows(tableData) {
  if (tableData && Array.isArray(tableData.rows)) {
    return tableData.rows;
  }

  if (!tableData || typeof tableData !== "object" || Array.isArray(tableData)) {
    return [];
  }

  const columnKeys = toSortedKeys(tableData);
  const rowKeys = Array.from(
    new Set(
      columnKeys.flatMap((columnKey) => Object.keys(tableData[columnKey] || {}))
    )
  ).sort((left, right) => Number(left) - Number(right));

  return rowKeys.map((rowKey) =>
    columnKeys.map((columnKey) => tableData?.[columnKey]?.[rowKey] ?? "")
  );
}

function applyTableStyling(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF0F172A" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0F2FE" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  worksheet.columns.forEach((column) => {
    let maxLength = 14;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, Math.min(value.length + 2, 40));
    });
    column.width = maxLength;
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, worksheet.columnCount) },
  };
}

function buildOverviewSheet(workbook, documentData, documentName) {
  const worksheet = workbook.addWorksheet("Overview");
  const pageCount = Array.isArray(documentData?.pages) ? documentData.pages.length : 0;
  const tableCount = Array.isArray(documentData?.tables) ? documentData.tables.length : 0;
  const imageCount = Array.isArray(documentData?.images) ? documentData.images.length : 0;

  worksheet.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Value", key: "value", width: 48 },
  ];

  worksheet.addRow({ field: "Document", value: documentName || "OCR Document" });
  worksheet.addRow({ field: "Exported At", value: new Date().toLocaleString("en-US") });
  worksheet.addRow({ field: "Pages", value: pageCount });
  worksheet.addRow({ field: "Tables", value: tableCount });
  worksheet.addRow({ field: "Images", value: imageCount });

  applyTableStyling(worksheet);
}

function buildTextSheet(workbook, documentData) {
  const worksheet = workbook.addWorksheet("Document Text");
  worksheet.columns = [
    { header: "Page", key: "page", width: 10 },
    { header: "Text", key: "text", width: 120 },
  ];

  const pages = Array.isArray(documentData?.pages) ? documentData.pages : [];

  if (!pages.length) {
    worksheet.addRow({ page: "-", text: "No extracted text available." });
  } else {
    pages.forEach((page) => {
      const text = Array.isArray(page?.blocks)
        ? page.blocks
            .map((block) => String(block?.text || "").trim())
            .filter(Boolean)
            .join("\n")
        : "";

      worksheet.addRow({
        page: page?.page_number ?? "",
        text: text || "No extracted text on this page.",
      });
    });
  }

  applyTableStyling(worksheet);
}

function buildTableSheets(workbook, documentData) {
  const pageTables = Array.isArray(documentData?.pages)
    ? documentData.pages.flatMap((page) => Array.isArray(page?.tables) ? page.tables : [])
    : [];
  const tables = pageTables.length
    ? pageTables
    : (Array.isArray(documentData?.tables) ? documentData.tables : []);

  if (!tables.length) {
    const worksheet = workbook.addWorksheet("Tables");
    worksheet.columns = [{ header: "Message", key: "message", width: 60 }];
    worksheet.addRow({ message: "No tables were detected in the uploaded PDF." });
    applyTableStyling(worksheet);
    return;
  }

  tables.forEach((table, index) => {
    const pageNumber = table?.page_number ? `P${table.page_number} ` : "";
    const worksheet = workbook.addWorksheet(
      sanitizeSheetName(`${pageNumber}Table ${index + 1}`, `Table${index + 1}`)
    );
    const rows = tableObjectToRows(table);

    if (!rows.length) {
      worksheet.columns = [{ header: "Message", key: "message", width: 60 }];
      worksheet.addRow({ message: "Table data is empty." });
      applyTableStyling(worksheet);
      return;
    }

    const [headerRow, ...bodyRows] = rows;
    worksheet.columns = headerRow.map((header, columnIndex) => ({
      header: String(header || `Column ${columnIndex + 1}`),
      key: `col_${columnIndex + 1}`,
      width: 20,
    }));

    if (bodyRows.length) {
      bodyRows.forEach((row) => worksheet.addRow(row));
    } else {
      worksheet.addRow(headerRow);
    }

    applyTableStyling(worksheet);
  });
}

async function createExcelWorkbookBuffer(documentData, documentName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TextTrack AI";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "OCR Document Export";
  workbook.title = `${documentName || "OCR Document"} Export`;

  buildOverviewSheet(workbook, documentData, documentName);
  buildTextSheet(workbook, documentData);
  buildTableSheets(workbook, documentData);

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  createExcelWorkbookBuffer,
};
