const path = require("path");
const { Activity } = require("../models");
const { convertPdfToWord } = require("../services/aiService");
const {
  buildActivityDetailPayload,
  extractDocumentData,
  getActivitySummary,
} = require("../services/activityHistoryService");
const { getArchivedDocumentPath } = require("../services/documentArchiveService");

async function getActivityForUser(userId, activityId) {
  return Activity.findOne({
    where: { id: activityId, userId },
  });
}

async function getRelatedActivities(userId, fileName) {
  if (!fileName) {
    return [];
  }

  return Activity.findAll({
    where: { userId, fileName },
    order: [["createdAt", "ASC"]],
    attributes: ["id", "action", "fileName", "fileSize", "status", "error", "metadata", "createdAt"],
  });
}

const getUserActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;

    const activities = await Activity.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit,
      attributes: ["id", "action", "fileName", "fileSize", "status", "error", "metadata", "createdAt"],
    });

    res.json({
      activities: activities.map((activity) => ({
        ...activity.toJSON(),
        summary: getActivitySummary(activity),
        hasDocumentData: Boolean(extractDocumentData(activity.metadata)),
      })),
      count: activities.length,
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
};

const getActivityDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const activityId = req.params.id;

    const activity = await getActivityForUser(userId, activityId);

    if (!activity) {
      return res.status(404).json({ error: "Activity not found or not authorized" });
    }

    const relatedActivities = await getRelatedActivities(userId, activity.fileName);
    const detailPayload = buildActivityDetailPayload(activity.toJSON(), relatedActivities.map((item) => item.toJSON()));

    res.json(detailPayload);
  } catch (error) {
    console.error("Get activity details error:", error);
    res.status(500).json({ error: "Failed to fetch activity details" });
  }
};

const downloadWordFromHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const activityId = req.params.id;

    const activity = await getActivityForUser(userId, activityId);

    if (!activity) {
      return res.status(404).json({ error: "Activity not found or not authorized" });
    }

    const relatedActivities = await getRelatedActivities(userId, activity.fileName);
    const detailPayload = buildActivityDetailPayload(activity.toJSON(), relatedActivities.map((item) => item.toJSON()));
    const sourceActivity = relatedActivities.find((item) => item.id === detailPayload.sourceActivityId);
    const archiveFileName = sourceActivity?.metadata?.historyContext?.archiveFileName;
    const archivePath = getArchivedDocumentPath(archiveFileName);

    if (!archivePath) {
      return res.status(400).json({
        error: "The original PDF is not available for this history entry. Please upload the file again to download Word.",
      });
    }

    const response = await convertPdfToWord(archivePath, activity.fileName);

    await Activity.create({
      userId,
      action: "WORD_EXPORT",
      fileName: activity.fileName,
      fileSize: activity.fileSize,
      status: "success",
      metadata: {
        source: "history",
        sourceActivityId: activity.id,
      },
    });

    const contentType =
      response.headers["content-type"] ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const fallbackName = `${path.parse(activity.fileName || "document.pdf").name}.docx`;
    const contentDisposition =
      response.headers["content-disposition"] || `attachment; filename="${fallbackName}"`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDisposition);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error("Download word from history error:", error);
    res.status(500).json({ error: "Failed to download Word from history" });
  }
};

const deleteActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const activityId = req.params.id;

    const activity = await getActivityForUser(userId, activityId);

    if (!activity) {
      return res.status(404).json({ error: "Activity not found or not authorized" });
    }

    // Delete ALL activities for this file (permanent delete)
    if (activity.fileName) {
      await Activity.destroy({
        where: { userId, fileName: activity.fileName },
      });
    } else {
      await activity.destroy();
    }

    res.json({ message: "Activity deleted successfully" });
  } catch (error) {
    console.error("Delete activity error:", error);
    res.status(500).json({ error: "Failed to delete record" });
  }
};

const updateActivityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, metadata, error } = req.body;

    const activity = await Activity.findByPk(id);
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    const updateData = { status, error };
    if (metadata) {
      updateData.metadata = { ...activity.metadata, ...metadata };
    }

    // If success, handle archiving
    if (status === "success") {
      const { archiveUploadedDocument } = require("../services/documentArchiveService");
      const fs = require("fs");
      const filePath = activity.metadata?.filePath; // We should have stored this

      // We need the original filename, which is in activity.fileName
      if (filePath && fs.existsSync(filePath)) {
        const archiveInfo = archiveUploadedDocument(filePath, activity.fileName);
        updateData.metadata.historyContext = archiveInfo;
        
        // Clean up original file
        fs.unlink(activity.metadata.filePath, () => {});
      }
    }

    await activity.update(updateData);
    res.json({ message: "Activity updated successfully" });
  } catch (error) {
    console.error("Update activity status error:", error);
    res.status(500).json({ error: "Failed to update activity status" });
  }
};

module.exports = {
  deleteActivity,
  downloadWordFromHistory,
  getActivityDetails,
  getUserActivities,
  updateActivityStatus,
};
