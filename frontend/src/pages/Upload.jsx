import { useState } from "react"
import { motion } from "framer-motion"
import UploadZone from "../components/UploadZone"
import ResultBox from "../components/ResultBox"

function Upload() {
  const [result, setResult] = useState(null)
  const [processedFile, setProcessedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: 800, margin: "0 auto" }}
    >
      <h1 style={{ marginBottom: "var(--space-2)" }}>Upload Document</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontSize: "var(--text-sm)" }}>
        Upload a PDF to extract text, tables, and images with AI-powered OCR.
      </p>

      <UploadZone
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
    </motion.div>
  )
}

export default Upload
