const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const passport = require("passport");
require("../config/passport");

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Google Auth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), authController.googleCallback);

// Protected routes
router.post("/logout", authMiddleware, authController.logout);
router.get("/profile", authMiddleware, authController.getProfile);
router.get("/verify", authMiddleware, authController.verifyTokenEndpoint);

module.exports = router;
