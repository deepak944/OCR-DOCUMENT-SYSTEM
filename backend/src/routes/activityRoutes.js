const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");

// Protected routes
router.get("/", authMiddleware, activityController.getUserActivities);
router.get("/:id", authMiddleware, activityController.getActivityDetails);
router.post("/:id/download-word", authMiddleware, activityController.downloadWordFromHistory);
router.delete("/:id", authMiddleware, activityController.deleteActivity);

module.exports = router;
