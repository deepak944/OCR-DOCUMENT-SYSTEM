const fs = require("fs");
const path = require("path");

const ARCHIVE_DIRECTORY = path.join(__dirname, "../../document_archive");

function ensureArchiveDirectory() {
  fs.mkdirSync(ARCHIVE_DIRECTORY, { recursive: true });
}

function safeBaseName(fileName) {
  return String(fileName || "document")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function archiveUploadedDocument(filePath, originalName) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  ensureArchiveDirectory();

  const extension = path.extname(originalName || filePath) || ".pdf";
  const archiveFileName = `${Date.now()}-${safeBaseName(path.parse(originalName || "document").name)}${extension}`;
  const archivePath = path.join(ARCHIVE_DIRECTORY, archiveFileName);

  fs.copyFileSync(filePath, archivePath);

  return {
    archiveFileName,
    originalFileName: originalName || path.basename(filePath),
    archivedAt: new Date().toISOString(),
  };
}

function getArchivedDocumentPath(archiveFileName) {
  if (!archiveFileName) {
    return null;
  }

  const resolvedPath = path.resolve(ARCHIVE_DIRECTORY, archiveFileName);
  const resolvedRoot = path.resolve(ARCHIVE_DIRECTORY);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    return null;
  }

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  return resolvedPath;
}

module.exports = {
  archiveUploadedDocument,
  getArchivedDocumentPath,
};
