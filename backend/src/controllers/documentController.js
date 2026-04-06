const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { processDocument, convertPdfToWord } = require("../services/aiService");
const { Activity } = require("../models");
const { archiveUploadedDocument } = require("../services/documentArchiveService");

function removeDirIfEmpty(dirPath) {
  if (!dirPath || path.basename(dirPath) !== "uploads") {
    return;
  }

  fs.readdir(dirPath, (readErr, files) => {
    if (readErr || files.length > 0) {
      return;
    }

    fs.rmdir(dirPath, () => {});
  });
}

function removeFileIfExists(filePath) {
  if (!filePath) {
    return;
  }

  fs.unlink(filePath, () => {
    removeDirIfEmpty(path.dirname(filePath));
  });
}

exports.uploadDocument = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded"
      });
    }

    const filePath = req.file.path;

    const result = await processDocument(filePath);

    const archiveInfo = archiveUploadedDocument(filePath, req.file.originalname);

    // Track activity
    await Activity.create({
      userId: req.user.id,
      action: "OCR_PROCESS",
      fileName: req.file.originalname,
      fileSize: req.file.size,
      status: "success",
      metadata: {
        documentData: result,
        historyContext: archiveInfo,
      },
    });

    res.json({
      message: "OCR processing completed",
      data: result
    });

  } catch (error) {

    console.error("OCR processing failed:", error.message);

    // Track failed activity
    await Activity.create({
      userId: req.user.id,
      action: "OCR_PROCESS",
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      status: "failed",
      error: error.message,
    });

    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error("AI service error response:", {
          status: error.response.status,
          data: error.response.data
        });
        return res.status(error.response.status).json(error.response.data);
      }

      if (error.request) {
        return res.status(502).json({
          error: "AI service is unavailable"
        });
      }
    }

    res.status(500).json({
      error: "OCR processing failed"
    });

  } finally {
    removeFileIfExists(req.file?.path);
  }
};

exports.downloadWordDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded"
      });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    const response = await convertPdfToWord(filePath, originalName);

    // Track activity
    await Activity.create({
      userId: req.user.id,
      action: "WORD_EXPORT",
      fileName: originalName,
      fileSize: req.file.size,
      status: "success",
    });

    const contentType = response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const fallbackName = `${path.parse(originalName || "document.pdf").name}.docx`;
    const contentDisposition = response.headers["content-disposition"] || `attachment; filename=\"${fallbackName}\"`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);

    res.send(Buffer.from(response.data));

  } catch (error) {
    console.error("Word download conversion failed:", error.message);

    // Track failed activity
    await Activity.create({
      userId: req.user.id,
      action: "WORD_EXPORT",
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      status: "failed",
      error: error.message,
    });

    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error("AI service word conversion error response:", {
          status: error.response.status,
          data: error.response.data
        });

        return res.status(error.response.status).json({
          error: "Word conversion failed"
        });
      }

      if (error.request) {
        return res.status(502).json({
          error: "AI service is unavailable"
        });
      }
    }

    res.status(500).json({
      error: "Word conversion failed"
    });

  } finally {
    removeFileIfExists(req.file?.path);
  }
};
