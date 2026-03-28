import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getActivities, deleteActivity, getResultFromCache } from "../services/api";
import Navbar from "../components/Navbar";
import Loader from "../components/Loader";

function History() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await getActivities();
      setActivities(response.data.activities);
    } catch (err) {
      setError("Failed to load activity history");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteActivity(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError("Failed to delete record. Please try again.");
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewDetails = (activity) => {
    // Prioritize results from the database, falling back to local cache
    const resultToRestore = activity.metadata || getResultFromCache(activity.fileName)?.data;
    
    navigate("/", {
      state: {
        restoredResult: resultToRestore,
        restoredFileName: activity.fileName,
      },
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionLabel = (action) => {
    const labels = { OCR_PROCESS: "OCR Processing", WORD_EXPORT: "Word Export" };
    return labels[action] || action;
  };

  const getStatusBadge = (status) => (
    <span className={`status-badge status-${status}`}>
      {status === "success" ? "✓" : "✗"} {status}
    </span>
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <Loader />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="history-container">
        <h1>Activity History</h1>
        {error && <div className="error-message">{error}</div>}

        {activities.length === 0 ? (
          <div className="empty-state">
            <p>No activities yet. Upload a document to get started!</p>
          </div>
        ) : (
          <div className="activities-list">
            {activities.map((activity) => {
              const hasCached = !!getResultFromCache(activity.fileName);
              return (
                <div key={activity.id} className="activity-card">
                  <div className="activity-header">
                    <span className="activity-action">
                      {getActionLabel(activity.action)}
                    </span>
                    <div className="activity-header-right">
                      {getStatusBadge(activity.status)}
                      <button
                        className="delete-activity-btn"
                        onClick={() => handleDelete(activity.id)}
                        disabled={deletingId === activity.id}
                        title="Delete record"
                      >
                        {deletingId === activity.id ? "..." : "🗑"}
                      </button>
                    </div>
                  </div>

                  <div className="activity-details">
                    <p><strong>File:</strong> {activity.fileName}</p>
                    <p>
                      <strong>Size:</strong>{" "}
                      {activity.fileSize
                        ? `${(activity.fileSize / 1024).toFixed(2)} KB`
                        : "—"}
                    </p>
                    <p><strong>Time:</strong> {formatDate(activity.createdAt || activity.timestamp)}</p>
                    {activity.error && (
                      <p className="error-text">
                        <strong>Error:</strong> {activity.error}
                      </p>
                    )}
                  </div>

                  {(activity.action === "OCR_PROCESS" || activity.action === "WORD_EXPORT") && activity.status === "success" && (
                    <div className="activity-footer">
                      <button
                        className="view-details-btn"
                        onClick={() => handleViewDetails(activity)}
                      >
                        {activity.metadata || hasCached ? "👁 View Details" : "↩ Go to Dashboard"}
                      </button>
                      {(!activity.metadata && !hasCached) && (
                        <span className="no-cache-note">
                          Result not cached — re-upload to view extracted data
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default History;
