const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { AI_SERVICE_URL } = require("../config/config");

async function processDocument(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Uploaded file not found at path: ${filePath}`);
  }

  const formData = new FormData();

  formData.append("file", fs.createReadStream(filePath));

  const response = await axios.post(
    `${AI_SERVICE_URL}/process-document`,
    formData,
    {
      headers: formData.getHeaders(),
      timeout: 300000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    }
  );

  return response.data;
}

async function convertPdfToWord(filePath, originalName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Uploaded file not found at path: ${filePath}`);
  }

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
      maxContentLength: Infinity
    }
  );

  return response;
}

module.exports = { processDocument, convertPdfToWord };
