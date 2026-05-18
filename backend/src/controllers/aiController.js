const { generateDocumentAssistantResponse } = require("../services/geminiService");
const { createExcelWorkbookBuffer } = require("../services/excelExportService");
const { convertOcrDataToWord, convertOcrDataToCad } = require("../services/aiService");
const { Activity } = require("../models");

exports.chatWithDocument = async (req, res) => {
  try {
    const { message, documentData, history, documentName, language = "en" } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "A message is required",
      });
    }

    if (!documentData || typeof documentData !== "object" || Array.isArray(documentData)) {
      return res.status(400).json({
        error: "documentData must be a JSON object",
      });
    }

    const normalizedHistory = Array.isArray(history)
      ? history
          .filter((entry) => entry && typeof entry.content === "string")
          .map((entry) => ({
            role: entry.role === "assistant" ? "assistant" : "user",
            content: entry.content,
          }))
      : [];

    const response = await generateDocumentAssistantResponse(
      message.trim(),
      documentData,
      normalizedHistory,
      documentName,
      language
    );

    await Activity.create({
      userId: req.user.id,
      action: "AI_CHAT",
      fileName: documentName || "OCR Document",
      status: "success",
      metadata: {
        prompt: message.trim(),
        response,
        language,
      },
    });

    res.json({
      response,
    });
  } catch (error) {
    console.error("AI chat failed:", error.message);

    try {
      await Activity.create({
        userId: req.user.id,
        action: "AI_CHAT",
        fileName: req.body?.documentName || "OCR Document",
        status: "failed",
        error: error.message,
        metadata: {
          prompt: typeof req.body?.message === "string" ? req.body.message.trim() : "",
          language: req.body?.language || "en",
        },
      });
    } catch (activityError) {
      console.error("AI chat activity logging failed:", activityError.message);
    }

    if (error.message === "GEMINI_API_KEY is not configured") {
      return res.status(500).json({
        error: "AI assistant is not configured on the server",
      });
    }

    res.status(500).json({
      error: "AI assistant request failed",
    });
  }
};

exports.exportDocumentExcel = async (req, res) => {
  const { documentData, documentName, language = "en" } = req.body;

  if (!documentData || typeof documentData !== "object" || Array.isArray(documentData)) {
    return res.status(400).json({
      error: "documentData must be a JSON object",
    });
  }

  const resolvedDocumentName = String(documentName || "OCR Document").trim() || "OCR Document";
  const fileBaseName = resolvedDocumentName.replace(/\.pdf$/i, "") || "ocr-document";

  try {
    const workbookBuffer = await createExcelWorkbookBuffer(documentData, resolvedDocumentName);

    await Activity.create({
      userId: req.user.id,
      action: "EXCEL_EXPORT",
      fileName: resolvedDocumentName,
      status: "success",
      metadata: {
        documentData,
        pages: Array.isArray(documentData?.pages) ? documentData.pages.length : 0,
        tables: Array.isArray(documentData?.tables) ? documentData.tables.length : 0,
        language,
      },
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileBaseName}.xlsx"`
    );

    res.send(Buffer.from(workbookBuffer));
  } catch (error) {
    console.error("Excel export failed:", error.message);

    await Activity.create({
      userId: req.user.id,
      action: "EXCEL_EXPORT",
      fileName: resolvedDocumentName,
      status: "failed",
      error: error.message,
      metadata: {
        language,
      },
    });

    res.status(500).json({
      error: "Excel export failed",
    });
  }
};

exports.exportDocumentWord = async (req, res) => {
  const { documentData, documentName, language = "en" } = req.body;

  if (!documentData || typeof documentData !== "object" || Array.isArray(documentData)) {
    return res.status(400).json({
      error: "documentData must be a JSON object",
    });
  }

  const resolvedDocumentName = String(documentName || "OCR Document").trim() || "OCR Document";

  try {
    const response = await convertOcrDataToWord(documentData, resolvedDocumentName);

    await Activity.create({
      userId: req.user.id,
      action: "WORD_EXPORT",
      fileName: resolvedDocumentName,
      status: "success",
      metadata: {
        source: "ocr-json",
        pages: Array.isArray(documentData?.pages) ? documentData.pages.length : 0,
        tables: Array.isArray(documentData?.tables) ? documentData.tables.length : 0,
        language,
      },
    });

    const contentType =
      response.headers["content-type"] ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const fileBaseName = resolvedDocumentName.replace(/\.pdf$/i, "") || "ocr-document";
    const contentDisposition =
      response.headers["content-disposition"] || `attachment; filename="${fileBaseName}.docx"`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error("Word OCR export failed:", error.message);

    await Activity.create({
      userId: req.user.id,
      action: "WORD_EXPORT",
      fileName: resolvedDocumentName,
      status: "failed",
      error: error.message,
      metadata: {
        source: "ocr-json",
        language,
      },
    });

    res.status(500).json({
      error: "Word download failed. Please try again.",
    });
  }
};

exports.exportDocumentCad = async (req, res) => {
  const { documentData, documentName, language = "en" } = req.body;

  if (!documentData || typeof documentData !== "object" || Array.isArray(documentData)) {
    return res.status(400).json({
      error: "documentData must be a JSON object",
    });
  }

  const resolvedDocumentName = String(documentName || "OCR Document").trim() || "OCR Document";

  try {
    const response = await convertOcrDataToCad(documentData, resolvedDocumentName);

    await Activity.create({
      userId: req.user.id,
      action: "CAD_EXPORT",
      fileName: resolvedDocumentName,
      status: "success",
      metadata: {
        source: "ocr-json",
        pages: Array.isArray(documentData?.pages) ? documentData.pages.length : 0,
        tables: Array.isArray(documentData?.tables) ? documentData.tables.length : 0,
        language,
      },
    });

    const contentType =
      response.headers["content-type"] || "image/vnd.dxf";
    const fileBaseName = resolvedDocumentName.replace(/\.pdf$/i, "") || "ocr-document";
    const contentDisposition =
      response.headers["content-disposition"] || `attachment; filename="${fileBaseName}.dxf"`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error("CAD OCR export failed:", error.message);

    await Activity.create({
      userId: req.user.id,
      action: "CAD_EXPORT",
      fileName: resolvedDocumentName,
      status: "failed",
      error: error.message,
      metadata: {
        source: "ocr-json",
        language,
      },
    });

    res.status(500).json({
      error: "CAD download failed. Please try again.",
    });
  }
};

