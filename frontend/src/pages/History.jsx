import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  deleteActivity,
  getActivities,
  getActivityDetails,
  getResultFromCache,
} from "../services/api"
import Navbar from "../components/Navbar"
import Loader from "../components/Loader"

function getDocumentData(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  if (metadata.documentData && typeof metadata.documentData === "object") {
    return metadata.documentData
  }

  if (Array.isArray(metadata.pages) || Array.isArray(metadata.tables) || Array.isArray(metadata.images)) {
    return metadata
  }

  return null
}

function getCachedDocumentData(fileName) {
  const cached = getResultFromCache(fileName)?.data

  if (!cached) {
    return null
  }

  return cached?.data || cached
}

function pickReferenceActivity(sortedItems) {
  return (
    sortedItems.find(
      (activity) =>
        activity.status === "success" &&
        activity.action === "OCR_PROCESS" &&
        getDocumentData(activity.metadata)
    ) ||
    sortedItems.find((activity) => getDocumentData(activity.metadata)) ||
    sortedItems[0]
  )
}

function getActionLabel(action) {
  const labels = {
    OCR_PROCESS: "OCR",
    WORD_EXPORT: "Word",
    EXCEL_EXPORT: "Excel",
    AI_CHAT: "AI Chat",
  }

  return labels[action] || action
}

function groupActivitiesByFile(activities) {
  const groups = new Map()

  activities.forEach((activity) => {
    const fileKey = activity.fileName || `activity-${activity.id}`
    const current = groups.get(fileKey) || []
    current.push(activity)
    groups.set(fileKey, current)
  })

  return Array.from(groups.entries())
    .map(([fileName, items]) => {
      const sortedItems = items
        .slice()
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))

      const referenceActivity = pickReferenceActivity(sortedItems)
      const documentData =
        getDocumentData(referenceActivity?.metadata) ||
        getCachedDocumentData(fileName) ||
        null
      const pages = Array.isArray(documentData?.pages) ? documentData.pages.length : 0
      const tables = Array.isArray(documentData?.tables)
        ? documentData.tables.length
        : Array.isArray(documentData?.pages)
          ? documentData.pages.reduce(
              (count, page) => count + (Array.isArray(page?.tables) ? page.tables.length : 0),
              0
            )
          : 0
      const images = Array.isArray(documentData?.images) ? documentData.images : []
      const actionCounts = sortedItems.reduce((countMap, activity) => {
        countMap[activity.action] = (countMap[activity.action] || 0) + 1
        return countMap
      }, {})

      return {
        fileName,
        items: sortedItems,
        latestActivity: sortedItems[0],
        referenceActivity,
        openActivityId: referenceActivity?.id || sortedItems[0]?.id,
        documentData,
        pageCount: pages,
        tableCount: tables,
        imageCount: images.length,
        imagePreviews: images.slice(0, 3),
        actionCounts,
      }
    })
    .sort((left, right) => new Date(right.latestActivity.createdAt) - new Date(left.latestActivity.createdAt))
}

function History() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState(null)
  const [openingId, setOpeningId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchActivities()
  }, [])

  const fileGroups = useMemo(() => groupActivitiesByFile(activities), [activities])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const response = await getActivities()
      setActivities(response.data.activities)
    } catch (err) {
      setError("Failed to load activity history")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteActivity(id)
      setActivities((current) => current.filter((activity) => activity.id !== id))
    } catch (err) {
      setError("Failed to delete record. Please try again.")
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleViewDetails = async (group) => {
    setOpeningId(group.openActivityId)
    setError("")

    try {
      const response = await getActivityDetails(group.openActivityId)
      const detail = response.data
      const restoredResult =
        detail.documentData ||
        group.documentData ||
        getCachedDocumentData(group.fileName)

      if (!restoredResult) {
        setError("This history entry does not have enough saved document data to reopen yet.")
        return
      }

      navigate("/", {
        state: {
          restoredResult,
          restoredFileName: detail.documentName || group.fileName,
          restoredTimeline: detail.relatedActivities || [],
          restoredActivityId: detail.sourceActivityId || group.openActivityId,
          canDownloadWordFromHistory: Boolean(detail.availableActions?.canDownloadWord),
        },
      })
    } catch (err) {
      setError("Failed to open this history entry. Please try again.")
      console.error(err)
    } finally {
      setOpeningId(null)
    }
  }

  const formatDate = (dateString) => new Date(dateString).toLocaleString()

  if (loading) {
    return (
      <>
        <Navbar />
        <Loader />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="history-container">
        <h1>Activity History</h1>
        {error && <div className="error-message">{error}</div>}

        {fileGroups.length === 0 ? (
          <div className="empty-state">
            <p>No activities yet. Upload a document to get started!</p>
          </div>
        ) : (
          <div className="activities-list">
            {fileGroups.map((group) => (
              <div key={group.fileName} className="activity-card activity-card--grouped">
                <div className="activity-header">
                  <span className="activity-action">{group.fileName}</span>
                  <div className="activity-header-right">
                    <span className={`status-badge status-${group.latestActivity.status}`}>
                      {group.latestActivity.status}
                    </span>
                    <button
                      className="delete-activity-btn"
                      onClick={() => handleDelete(group.latestActivity.id)}
                      disabled={deletingId === group.latestActivity.id}
                      title="Delete latest record"
                    >
                      {deletingId === group.latestActivity.id ? "..." : "Delete Latest"}
                    </button>
                  </div>
                </div>

                <div className="activity-details">
                  <p><strong>Last updated:</strong> {formatDate(group.latestActivity.createdAt)}</p>
                  <p>
                    <strong>Document details:</strong> {group.pageCount} page{group.pageCount === 1 ? "" : "s"},{" "}
                    {group.tableCount} table{group.tableCount === 1 ? "" : "s"},{" "}
                    {group.imageCount} extracted image{group.imageCount === 1 ? "" : "s"}
                  </p>
                  <p><strong>Saved actions:</strong> {group.items.length}</p>
                </div>

                <div className="history-action-summary">
                  {Object.entries(group.actionCounts).map(([action, count]) => (
                    <span key={action} className="history-action-chip">
                      {getActionLabel(action)} x{count}
                    </span>
                  ))}
                </div>

                <div className="history-card-grid">
                  <div className="history-card-panel">
                    <div className="history-card-panel-header">
                      <strong>Extracted Images</strong>
                      <span>{group.imageCount}</span>
                    </div>
                    {group.imagePreviews.length === 0 ? (
                      <p className="history-card-empty">No extracted images saved for this PDF.</p>
                    ) : (
                      <div className="history-image-strip">
                        {group.imagePreviews.map((image, index) => (
                          <div
                            key={`${image?.page_number || "page"}-${image?.image_index || index}`}
                            className="history-image-preview"
                          >
                            {image?.data_url ? (
                              <img
                                src={image.data_url}
                                alt={`History preview ${index + 1}`}
                                className="history-image-preview-img"
                              />
                            ) : (
                              <div className="history-image-placeholder">Preview unavailable</div>
                            )}
                            <p>
                              Page {image?.page_number || "?"} | {image?.extension || "image"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="history-card-panel">
                    <div className="history-card-panel-header">
                      <strong>What You Did On This PDF</strong>
                      <span>{group.items.length}</span>
                    </div>
                    <div className="history-activity-list">
                      {group.items.slice(0, 6).map((activity) => (
                        <div key={activity.id} className="history-activity-item">
                          <div>
                            <strong>{getActionLabel(activity.action)}</strong>
                            <p>{formatDate(activity.createdAt)}</p>
                          </div>
                          <span className={`status-badge status-${activity.status}`}>
                            {activity.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="activity-footer">
                  <button
                    className="view-details-btn"
                    onClick={() => handleViewDetails(group)}
                    disabled={openingId === group.openActivityId}
                  >
                    {openingId === group.openActivityId ? "Opening..." : "View Details"}
                  </button>
                  <span className="no-cache-note">
                    Open this file to continue working with the saved OCR result, AI, Excel, and Word actions.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default History
