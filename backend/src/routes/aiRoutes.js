const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { chatWithDocument, exportDocumentExcel } = require("../controllers/aiController");

const router = express.Router();

router.post("/chat", authMiddleware, chatWithDocument);
router.post("/export-excel", authMiddleware, exportDocumentExcel);

module.exports = router;
