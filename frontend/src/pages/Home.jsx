import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import UploadBox from "../components/UploadBox";
import ResultBox from "../components/ResultBox";

function Home() {
  const location = useLocation();
  const [result, setResult] = useState(null);
  const [processedFile, setProcessedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // Label shown when result is restored from history
  const [restoredFileName, setRestoredFileName] = useState(null);

  useEffect(() => {
    // When navigated from History "View Details", restore the cached result
    if (location.state?.restoredResult) {
      setResult(location.state.restoredResult);
      setRestoredFileName(location.state.restoredFileName || null);
      setProcessedFile(null); // original file not available
    } else if (!location.state) {
      // Clear the dashboard if navigated to without any state
      setResult(null);
      setRestoredFileName(null);
      setProcessedFile(null);
    }
  }, [location.state]);

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
              <li><strong>1. Upload</strong> <span>Drag and drop your PDF or image into the secure processing zone.</span></li>
              <li><strong>2. AI Extraction</strong> <span>Our system intelligently reads text, tables, and layouts using PaddleOCR.</span></li>
              <li><strong>3. Export</strong> <span>Instantly download your fully formatted, editable Microsoft Word document.</span></li>
            </ul>
          </div>

          <div className="nav-links">
            <Link to="/history" className="nav-link">
              📊 View History
            </Link>
          </div>

          {restoredFileName && (
            <div className="restored-banner">
              📂 Showing saved result for <strong>{restoredFileName}</strong>
              <button
                className="restored-clear-btn"
                onClick={() => { setResult(null); setRestoredFileName(null); }}
              >
                ✕ Clear
              </button>
            </div>
          )}

          <UploadBox
            setResult={(r) => { setResult(r); setRestoredFileName(null); }}
            setProcessedFile={setProcessedFile}
            setIsLoading={setIsLoading}
          />

          <ResultBox result={result} processedFile={processedFile} isLoading={isLoading} />
        </section>
      </main>
    </>
  );
}

export default Home;
