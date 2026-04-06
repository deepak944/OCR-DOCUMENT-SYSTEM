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
  const activeResult = result || restoredResult
  const activeDocumentName = processedFile?.name || restoredFileName

  return (
    <>
      <Navbar />
      <main className="pageShell">
        <section className="card">
          <h1 className="cardTitle">Welcome to TextTrack AI</h1>
          <p className="cardSubtitle">
            Your professional document intelligence platform.
          </p>

          <div className="how-it-works">
            <h3>How It Works</h3>
            <ul>
              <li>
                <strong>1. Upload</strong>
                <span>Drag and drop your PDF or image into the secure processing zone.</span>
              </li>
              <li>
                <strong>2. AI Extraction</strong>
                <span>Our system intelligently reads text, tables, and layouts using PaddleOCR.</span>
              </li>
              <li>
                <strong>3. Export</strong>
                <span>Instantly download your fully formatted, editable Microsoft Word document.</span>
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
          />
        </section>
      </main>
    </>
  )
}

export default Home
