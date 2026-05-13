const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// All these are handled by authMiddleware (Firebase verification)
router.get("/profile", authMiddleware, authController.getProfile);
router.get("/verify", authMiddleware, authController.verifyTokenEndpoint);

module.exports = router;
