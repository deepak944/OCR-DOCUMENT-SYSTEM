const express = require("express");

const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");

const { uploadDocument, downloadWordDocument } = require("../controllers/documentController");

router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  uploadDocument
);

router.post(
  "/download-word",
  authMiddleware,
  upload.single("file"),
  downloadWordDocument
);

module.exports = router;
