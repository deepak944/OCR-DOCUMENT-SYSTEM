function extractDocumentData(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  if (
    metadata.documentData &&
    typeof metadata.documentData === "object" &&
    !Array.isArray(metadata.documentData)
  ) {
    return metadata.documentData;
  }

  if (Array.isArray(metadata.pages) || Array.isArray(metadata.tables) || Array.isArray(metadata.images)) {
    return metadata;
  }

  return null;
}

function getArchiveInfo(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const historyContext =
    metadata.historyContext && typeof metadata.historyContext === "object"
      ? metadata.historyContext
      : null;

  if (!historyContext?.archiveFileName) {
    return null;
  }

  return historyContext;
}

function getActivitySummary(activity) {
  const metadata =
    activity?.metadata && typeof activity.metadata === "object" ? activity.metadata : {};

  if (activity?.action === "AI_CHAT") {
    return metadata.prompt || metadata.userMessage || "";
  }

  if (activity?.action === "OCR_PROCESS") {
    const documentData = extractDocumentData(metadata);
    const pageCount = Array.isArray(documentData?.pages) ? documentData.pages.length : 0;
    const tableCount = Array.isArray(documentData?.tables)
      ? documentData.tables.length
      : Array.isArray(documentData?.pages)
        ? documentData.pages.reduce(
            (count, page) => count + (Array.isArray(page?.tables) ? page.tables.length : 0),
            0
          )
        : 0;

    if (pageCount || tableCount) {
      return `${pageCount} page${pageCount === 1 ? "" : "s"}, ${tableCount} table${
        tableCount === 1 ? "" : "s"
      }`;
    }
  }

  if (activity?.action === "EXCEL_EXPORT") {
    const pageCount = Number(metadata.pages || 0);
    const tableCount = Number(metadata.tables || 0);

    if (pageCount || tableCount) {
      return `${pageCount} page${pageCount === 1 ? "" : "s"}, ${tableCount} table${
        tableCount === 1 ? "" : "s"
      } exported`;
    }
  }

  if (activity?.action === "WORD_EXPORT") {
    return "Word document prepared";
  }

  return "";
}

function findBestDocumentActivity(activity, relatedActivities = []) {
  const ownDocument = extractDocumentData(activity?.metadata);
  if (ownDocument) {
    return activity;
  }

  const explicitSourceActivityId = Number(activity?.metadata?.sourceActivityId || 0);
  if (explicitSourceActivityId) {
    const explicitMatch = relatedActivities.find(
      (candidate) => candidate?.id === explicitSourceActivityId && extractDocumentData(candidate?.metadata)
    );

    if (explicitMatch) {
      return explicitMatch;
    }
  }

  const targetTime = activity?.createdAt
    ? new Date(activity.createdAt).getTime()
    : Number.POSITIVE_INFINITY;

  const ocrActivities = relatedActivities
    .filter(
      (candidate) =>
        candidate?.status === "success" &&
        candidate?.action === "OCR_PROCESS" &&
        extractDocumentData(candidate.metadata)
    )
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

  const previousMatch = ocrActivities
    .slice()
    .reverse()
    .find((candidate) => new Date(candidate.createdAt).getTime() <= targetTime);

  if (previousMatch) {
    return previousMatch;
  }

  return ocrActivities[0] || null;
}

function getSessionActivities(activity, relatedActivities = [], sourceActivity) {
  const orderedActivities = relatedActivities
    .slice()
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

  if (!sourceActivity?.createdAt) {
    return orderedActivities;
  }

  const sourceTime = new Date(sourceActivity.createdAt).getTime();
  const nextOcrActivity = orderedActivities.find(
    (candidate) =>
      candidate?.id !== sourceActivity.id &&
      candidate?.status === "success" &&
      candidate?.action === "OCR_PROCESS" &&
      extractDocumentData(candidate?.metadata) &&
      new Date(candidate.createdAt).getTime() > sourceTime
  );

  const nextOcrTime = nextOcrActivity ? new Date(nextOcrActivity.createdAt).getTime() : Number.POSITIVE_INFINITY;

  return orderedActivities.filter((candidate) => {
    const candidateTime = new Date(candidate.createdAt).getTime();
    return candidateTime >= sourceTime && candidateTime < nextOcrTime;
  });
}

function buildHistoryTimeline(relatedActivities = []) {
  return relatedActivities
    .slice()
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .map((activity) => ({
      id: activity.id,
      action: activity.action,
      status: activity.status,
      createdAt: activity.createdAt,
      error: activity.error || "",
      summary: getActivitySummary(activity),
      prompt:
        activity.action === "AI_CHAT" && activity.metadata?.prompt
          ? activity.metadata.prompt
          : "",
      response:
        activity.action === "AI_CHAT" && activity.metadata?.response
          ? activity.metadata.response
          : "",
    }));
}

function buildActivityDetailPayload(activity, relatedActivities = []) {
  const sourceActivity = findBestDocumentActivity(activity, relatedActivities);
  const sourceMetadata = sourceActivity?.metadata || null;
  const documentData = extractDocumentData(sourceMetadata);
  const archiveInfo = getArchiveInfo(sourceMetadata);
  const sessionActivities = getSessionActivities(activity, relatedActivities, sourceActivity);

  return {
    activity,
    documentData,
    documentName: activity?.fileName || sourceActivity?.fileName || "OCR Document",
    relatedActivities: buildHistoryTimeline(sessionActivities),
    availableActions: {
      canTalkWithAI: Boolean(documentData),
      canDownloadExcel: Boolean(documentData),
      canDownloadWord: Boolean(archiveInfo?.archiveFileName),
    },
    sourceActivityId: sourceActivity?.id || null,
  };
}

module.exports = {
  buildActivityDetailPayload,
  extractDocumentData,
  findBestDocumentActivity,
  getActivitySummary,
  getSessionActivities,
};
