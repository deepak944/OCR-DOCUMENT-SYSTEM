const express = require("express");

const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const { uploadDocument, downloadWordDocument } = require("../controllers/documentController");

router.post(
  "/upload",
  upload.single("file"),
  uploadDocument
);

router.post(
  "/download-word",
  upload.single("file"),
  downloadWordDocument
);

module.exports = router;
