const { Activity, User } = require("../models");

const getUserActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const activities = await Activity.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'action', 'fileName', 'fileSize', 'status', 'error', 'metadata', 'createdAt'],
    });

    res.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
};

const deleteActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const activityId = req.params.id;

    const activity = await Activity.findOne({
      where: { id: activityId, userId }
    });

    if (!activity) {
      return res.status(404).json({ error: "Activity not found or not authorized" });
    }

    await activity.destroy();

    res.json({ message: "Activity deleted successfully" });
  } catch (error) {
    console.error("Delete activity error:", error);
    res.status(500).json({ error: "Failed to delete activity" });
  }
};

module.exports = {
  getUserActivities,
  deleteActivity,
};
