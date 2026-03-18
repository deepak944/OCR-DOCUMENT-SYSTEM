const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected routes
router.post("/logout", authMiddleware, authController.logout);
router.get("/profile", authMiddleware, authController.getProfile);
router.get("/verify", authMiddleware, authController.verifyTokenEndpoint);

module.exports = router;
