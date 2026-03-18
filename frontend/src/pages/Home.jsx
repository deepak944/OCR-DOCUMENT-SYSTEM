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
    }
  }, [location.state]);

  return (
    <>
      <Navbar />
      <main className="pageShell">
        <section className="card">
          <h1 className="cardTitle">OCR Document Extractor</h1>
          <p className="cardSubtitle">
            Upload a PDF, extract text, tables, and embedded images, then
            download the output in Word format.
          </p>

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
