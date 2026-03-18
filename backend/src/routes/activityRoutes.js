const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");

// Protected routes
router.get("/", authMiddleware, activityController.getUserActivities);
router.delete("/:id", authMiddleware, activityController.deleteActivity);

module.exports = router;
