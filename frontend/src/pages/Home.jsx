import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, MessageSquare, FileText, Zap, Brain, CheckCircle } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import UploadZone from "../components/UploadZone"
import ResultBox from "../components/ResultBox"
import { getActivities } from "../services/api"

function Home() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [result, setResult] = useState(null)
  const [processedFile, setProcessedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({ docs: 0, pages: 0 })

  // Handle restored state from sidebar click or history
  const restoredResult = location.state?.restoredResult || null
  const restoredFileName = location.state?.restoredFileName || null
  const restoredTimeline = location.state?.restoredTimeline || []
  const restoredActivityId = location.state?.restoredActivityId || null
  const canDownloadWordFromHistory = Boolean(location.state?.canDownloadWordFromHistory)

  // Use restored data as active result if we don't have a fresh upload
  const activeResult = result || restoredResult
  const activeDocumentName = processedFile?.name || restoredFileName

  useEffect(() => {
    if (isAuthenticated) {
      getActivities()
        .then((res) => {
          const acts = res.data.activities || []
          const uniqueFiles = new Set(acts.map((a) => a.fileName).filter(Boolean))
          setStats({ docs: uniqueFiles.size, pages: acts.length })
        })
        .catch(() => {})
    }
  }, [isAuthenticated])

  const features = [
    { icon: Upload, title: "Upload PDF", desc: "Drag & drop to extract text", path: "/upload", action: "upload" },
    { icon: Brain, title: "AI-Powered OCR", desc: "PaddleOCR + Gemini AI", path: "/upload", action: "upload" },
    { icon: MessageSquare, title: "Chat with Docs", desc: "Ask anything about your PDF", path: "/ai-chat", action: "navigate" },
    { icon: FileText, title: "PDF to AutoCAD", desc: "Premium CAD DXF vectorization", path: "/", action: "upload" },
  ]



  // Only show features/upload when no document is loaded
  const showWelcome = !activeResult

  return (
    <div className="welcome-section">
      {/* Welcome Header */}
      <motion.div
        className="welcome-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="welcome-title">
          {activeResult ? (
            <>Viewing: <span className="text-gradient">{activeDocumentName || "Document"}</span></>
          ) : isAuthenticated ? (
            <>Welcome back, <span className="text-gradient">{user?.name?.split(" ")[0] || "User"}</span> 👋</>
          ) : (
            <>Welcome to <span className="text-gradient">TextTrack AI</span></>
          )}
        </h1>
        {!activeResult && (
          <p className="welcome-subtitle">
            Your AI-powered document intelligence platform
          </p>
        )}
      </motion.div>

      {/* Restored Doc Info Bar */}
      {restoredResult && !result && (
        <motion.div
          className="restored-doc-bar surface-card"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="restored-doc-info">
            <CheckCircle size={16} style={{ color: "var(--color-success)" }} />
            <span>
              <strong>{restoredFileName}</strong> loaded from history
              {restoredTimeline.length > 0 && (
                <> — {restoredTimeline.length} activit{restoredTimeline.length === 1 ? "y" : "ies"} found</>
              )}
            </span>
          </div>
          <div className="restored-doc-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/", { replace: true, state: null })}
            >
              Close
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats - only when no document is active */}
      {showWelcome && isAuthenticated && (
        <motion.div
          className="welcome-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="stat-card glass-card">
            <div className="stat-value">{stats.docs}</div>
            <div className="stat-label">Documents</div>
          </div>
          <div className="stat-card glass-card">
            <div className="stat-value">{stats.pages}</div>
            <div className="stat-label">Activities</div>
          </div>
          <div className="stat-card glass-card">
            <div className="stat-value"><Zap size={20} style={{ display: "inline" }} /></div>
            <div className="stat-label">AI Ready</div>
          </div>
        </motion.div>
      )}

      {/* Features - only when no document is active */}
      {showWelcome && (
        <motion.div
          className="welcome-features"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              className="feature-card surface-card"
              style={{ cursor: "pointer" }}
              onClick={() => {
                if (f.action === "upload") {
                  const fileInput = document.querySelector('input[type="file"]');
                  if (fileInput) {
                    fileInput.click();
                  } else {
                    const uploadZone = document.querySelector(".upload-dropzone");
                    if (uploadZone) {
                      uploadZone.scrollIntoView({ behavior: "smooth" });
                    }
                  }
                } else {
                  navigate(f.path);
                }
              }}
            >
              <div className="feature-icon"><f.icon size={24} /></div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}

        </motion.div>
      )}

      {/* Upload Zone - only when no document is active */}
      {showWelcome && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <UploadZone
            setResult={(nextResult) => {
              setResult(nextResult)
              setProcessedFile(null)
            }}
            setProcessedFile={setProcessedFile}
            setIsLoading={setIsLoading}
          />
        </motion.div>
      )}

      {/* Result - shows both for fresh upload and restored docs */}
      <ResultBox
        result={activeResult}
        processedFile={processedFile}
        documentName={activeDocumentName}
        isLoading={isLoading}
        restoredTimeline={restoredTimeline}
        restoredActivityId={restoredActivityId}
        canDownloadWordFromHistory={canDownloadWordFromHistory}
      />
    </div>
  )
}

export default Home
