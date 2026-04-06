import { useState } from "react"
import Navbar from "../components/Navbar"
import UploadBox from "../components/UploadBox"
import ResultBox from "../components/ResultBox"

function Upload() {
  const [result, setResult] = useState(null)
  const [processedFile, setProcessedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  return (
    <>
      <Navbar />
      <main className="pageShell">
        <section className="card">
          <h1 className="cardTitle">Upload Document</h1>
          <p className="cardSubtitle">
            Upload a PDF to extract text, tables, and images. Supports scanned documents.
          </p>

          <UploadBox
            setResult={setResult}
            setProcessedFile={setProcessedFile}
            setIsLoading={setIsLoading}
          />

          <ResultBox
            result={result}
            processedFile={processedFile}
            documentName={processedFile?.name}
            isLoading={isLoading}
          />
        </section>
      </main>
    </>
  )
}

export default Upload
