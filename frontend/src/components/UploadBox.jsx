import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { uploadFile, saveResultToCache } from "../services/api"

function UploadBox({ setResult, setProcessedFile, setIsLoading }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleUpload = async () => {
    if (!isAuthenticated) {
      setError("Please login or register to upload a document.")
      navigate("/login")
      return
    }

    if (!file) {
      setError("Please choose a PDF file first.")
      return
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    try {
      setIsUploading(true)
      if (setIsLoading) setIsLoading(true)
      setError("")
      setResult(null)

      const res = await uploadFile(formData)
      setResult(res.data)
      setProcessedFile(file)
      saveResultToCache(file.name, res.data)
    } catch (err) {
      const apiError = err?.response?.data?.error || err?.response?.data?.detail
      setError(apiError || "Upload failed. Please try again.")
      setResult(null)
      setProcessedFile(null)
    } finally {
      setIsUploading(false)
      if (setIsLoading) setIsLoading(false)
    }
  }

  return (
    <div className="uploadBox">
      {!isAuthenticated && (
        <div className="uploadGate">
          <p className="uploadGateTitle">Login or register to upload your PDF.</p>
          <p className="uploadGateText">
            Explore the main page first, then sign in when you are ready to start OCR, AI chat,
            and exports.
          </p>
          <div className="uploadGateActions">
            <Link to="/login" className="primaryBtn">
              Login
            </Link>
            <Link to="/register" className="nav-link">
              Register
            </Link>
          </div>
        </div>
      )}

      <label className="fileLabel">Choose PDF file</label>

      <input
        type="file"
        className="fileInput"
        accept=".pdf,application/pdf"
        onChange={(event) => setFile(event.target.files[0])}
        disabled={!isAuthenticated}
      />

      <div className="uploadActionRow">
        <button onClick={handleUpload} className="primaryBtn" disabled={isUploading || !isAuthenticated}>
          {isUploading ? "Processing..." : "Upload"}
        </button>

        {file && <p className="fileName">{file.name}</p>}
      </div>

      {isUploading && (
        <p className="fileName">Your PDF is uploaded. We are extracting text and tables now.</p>
      )}

      {error && <p className="errorText">{error}</p>}
    </div>
  )
}

export default UploadBox
