const activityStore = require("../models/Activity");

// Get user's activity history
const getUserActivities = (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const activities = activityStore.findByUserId(userId, limit);

    res.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
};

// Delete a specific activity (user-scoped)
const deleteActivity = (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid activity id" });
    }

    const deleted = activityStore.deleteById(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Activity not found" });
    }

    res.json({ message: "Activity deleted" });
  } catch (error) {
    console.error("Delete activity error:", error);
    res.status(500).json({ error: "Failed to delete activity" });
  }
};

module.exports = {
  getUserActivities,
  deleteActivity,
};
