import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import Navbar from "../components/Navbar"
import UploadBox from "../components/UploadBox"
import ResultBox from "../components/ResultBox"

function Home() {
  const location = useLocation()
  const [result, setResult] = useState(null)
  const [processedFile, setProcessedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dismissedRestoreKey, setDismissedRestoreKey] = useState(null)

  const hasRestoredState =
    Boolean(location.state?.restoredResult) && dismissedRestoreKey !== location.key
  const restoredResult = hasRestoredState ? location.state?.restoredResult : null
  const restoredFileName = hasRestoredState ? location.state?.restoredFileName || null : null
  const restoredTimeline = hasRestoredState ? location.state?.restoredTimeline || [] : []
  const restoredActivityId = hasRestoredState ? location.state?.restoredActivityId || null : null
  const canDownloadWordFromHistory = hasRestoredState
    ? Boolean(location.state?.canDownloadWordFromHistory)
    : false
  const activeResult = result || restoredResult
  const activeDocumentName = processedFile?.name || restoredFileName

  return (
    <>
      <Navbar />
      <main className="pageShell">
        <section className="card">
          <h1 className="cardTitle">
            <span className="homeTitleBase">Welcome to TextTrack</span>{" "}
            <span className="brand-ai">AI 📈</span>
          </h1>
          <p className="cardSubtitle">
            Your professional document intelligence platform.
          </p>

          <div className="how-it-works">
            <h3>How It Works</h3>
            <ul>
              <li>
                <strong>1. Upload</strong>
                <span>Upload a PDF to extract text, tables, layout blocks, and embedded images.</span>
              </li>
              <li>
                <strong>2. OCR + AI</strong>
                <span>TextTrack AI processes scanned or digital PDFs and prepares structured JSON for chat and export.</span>
              </li>
              <li>
                <strong>3. Continue Work</strong>
                <span>Talk with AI, download Word or Excel, and reopen saved document sessions from History.</span>
              </li>
            </ul>
          </div>

          <div className="nav-links">
            <Link to="/history" className="nav-link">
              View History
            </Link>
          </div>

          {restoredFileName && (
            <div className="restored-banner">
              <strong>{restoredFileName}</strong> restored from history.
              <button
                className="restored-clear-btn"
                onClick={() => {
                  setDismissedRestoreKey(location.key)
                }}
              >
                Clear
              </button>
            </div>
          )}

          <UploadBox
            setResult={(nextResult) => {
              setResult(nextResult)
              setProcessedFile(null)
              setDismissedRestoreKey(location.key)
            }}
            setProcessedFile={setProcessedFile}
            setIsLoading={setIsLoading}
          />

          <ResultBox
            result={activeResult}
            processedFile={processedFile}
            documentName={activeDocumentName}
            isLoading={isLoading}
            restoredTimeline={restoredTimeline}
            restoredActivityId={restoredActivityId}
            canDownloadWordFromHistory={canDownloadWordFromHistory}
          />
        </section>
      </main>
    </>
  )
}

export default Home
