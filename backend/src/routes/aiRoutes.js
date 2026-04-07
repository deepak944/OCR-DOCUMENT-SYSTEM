const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { chatWithDocument, exportDocumentExcel, exportDocumentWord } = require("../controllers/aiController");

const router = express.Router();

router.post("/chat", authMiddleware, chatWithDocument);
router.post("/export-excel", authMiddleware, exportDocumentExcel);
router.post("/export-word", authMiddleware, exportDocumentWord);

module.exports = router;
