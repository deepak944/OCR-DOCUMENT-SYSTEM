const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { AI_SERVICE_URL } = require("../config/config");

// Retry with exponential backoff for transient connection errors
async function withRetry(fn, retries = 3, baseDelayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err.code === "ECONNREFUSED" ||
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ENOTFOUND" ||
        err.message === "socket hang up";

      if (!isRetryable || attempt === retries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `AI service request failed (attempt ${attempt}/${retries}): ${err.message}. Retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function processDocument(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Uploaded file not found at path: ${filePath}`);
  }

  return withRetry(async () => {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));

    const response = await axios.post(
      `${AI_SERVICE_URL}/process-document`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 300000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return response.data;
  });
}

async function convertPdfToWord(filePath, originalName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Uploaded file not found at path: ${filePath}`);
  }

  return withRetry(async () => {
    const formData = new FormData();
    formData.append(
      "file",
      fs.createReadStream(filePath),
      originalName || path.basename(filePath)
    );

    const response = await axios.post(
      `${AI_SERVICE_URL}/convert-pdf-to-word`,
      formData,
      {
        headers: formData.getHeaders(),
        responseType: "arraybuffer",
        timeout: 300000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return response;
  });
}

async function convertOcrDataToWord(documentData, documentName) {
  return withRetry(async () => {
    const response = await axios.post(
      `${AI_SERVICE_URL}/convert-ocr-json-to-word`,
      {
        document_data: documentData,
        document_name: documentName || "OCR Document",
      },
      {
        responseType: "arraybuffer",
        timeout: 300000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return response;
  });
}

module.exports = { processDocument, convertPdfToWord, convertOcrDataToWord };
