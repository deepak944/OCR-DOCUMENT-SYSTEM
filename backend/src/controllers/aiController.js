const { generateDocumentAssistantResponse } = require("../services/geminiService");
const { createExcelWorkbookBuffer } = require("../services/excelExportService");
const { Activity } = require("../models");

exports.chatWithDocument = async (req, res) => {
  try {
    const { message, documentData, history, documentName } = req.body;

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
      documentName
    );

    await Activity.create({
      userId: req.user.id,
      action: "AI_CHAT",
      fileName: documentName || "OCR Document",
      status: "success",
      metadata: {
        prompt: message.trim(),
        response,
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
  const { documentData, documentName } = req.body;

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
    });

    res.status(500).json({
      error: "Excel export failed",
    });
  }
};
