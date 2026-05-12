import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useDropzone } from "react-dropzone"
import { motion, AnimatePresence } from "framer-motion"
import {
  CloudUpload, FileText, X, CheckCircle, AlertCircle, Loader2
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { uploadFile, saveResultToCache } from "../services/api"

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

function UploadZone({ setResult, setProcessedFile, setIsLoading, onUploadComplete }) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null) // "success" | "error"
  const [error, setError] = useState("")

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (!isAuthenticated) {
      setError("Please sign in to upload documents.")
      navigate("/login")
      return
    }

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors[0]?.code === "file-too-large") {
        setError("File exceeds 500MB limit.")
      } else if (rejection.errors[0]?.code === "file-invalid-type") {
        setError("Only PDF files are supported.")
      } else {
        setError("Invalid file. Please select a valid PDF.")
      }
      return
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0])
      setError("")
      setUploadStatus(null)
      setUploadProgress(0)
    }
  }, [isAuthenticated, navigate])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading,
  })

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return

    const formData = new FormData()
    formData.append("file", selectedFile)
    
    // Get language from localStorage and add to request
    const language = localStorage.getItem("texttrack-lang") || "en"
    formData.append("language", language)

    try {
      setIsUploading(true)
      setError("")
      setUploadProgress(0)
      if (setIsLoading) setIsLoading(true)
      if (setResult) setResult(null)

      // Real upload progress from axios (bytes actually sent over the network)
      const onUploadProgress = (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded / progressEvent.total) * 90)
          setUploadProgress(pct) // goes 0→90% during actual upload
        }
      }

      try {
        const res = await uploadFile(formData, onUploadProgress)
        setUploadProgress(100)
        setUploadStatus("success")

        if (setResult) setResult(res.data)
        if (setProcessedFile) setProcessedFile(selectedFile)
        saveResultToCache(selectedFile.name, res.data)

        if (onUploadComplete) {
          onUploadComplete(res.data, selectedFile.name)
        }
      } catch (err) {
        const apiError = err?.response?.data?.error || err?.response?.data?.detail
        setError(apiError || "Upload failed. Please try again.")
        setUploadStatus("error")
        if (setResult) setResult(null)
        if (setProcessedFile) setProcessedFile(null)
      }
    } finally {
      setIsUploading(false)
      if (setIsLoading) setIsLoading(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setUploadProgress(0)
    setUploadStatus(null)
    setError("")
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="upload-zone-wrapper">
      {/* Drop Zone */}
      <motion.div
        {...getRootProps()}
        className={`upload-dropzone ${isDragActive ? "upload-dropzone--active" : ""} ${isDragReject ? "upload-dropzone--reject" : ""} ${isUploading ? "upload-dropzone--uploading" : ""}`}
        whileHover={!isUploading ? { scale: 1.01 } : undefined}
        whileTap={!isUploading ? { scale: 0.99 } : undefined}
      >
        <input {...getInputProps()} />

        <motion.div
          className="upload-dropzone-content"
          animate={isDragActive ? { scale: 1.05 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <motion.div
            className="upload-icon-wrapper"
            animate={isDragActive ? { y: -8 } : { y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <CloudUpload
              size={48}
              className={`upload-icon ${isDragActive ? "upload-icon--active" : ""}`}
            />
          </motion.div>

          <h3 className="upload-title">
            {isDragActive ? "Drop your PDF here" : "Upload your document"}
          </h3>
          <p className="upload-subtitle">
            Drag & drop a PDF file here, or click to browse
          </p>
          <p className="upload-hint">Supports PDF files up to 500MB</p>
        </motion.div>
      </motion.div>

      {/* File Preview */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            className="upload-file-preview surface-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="upload-file-info">
              <div className="upload-file-icon">
                <FileText size={20} />
              </div>
              <div className="upload-file-details">
                <span className="upload-file-name truncate">{selectedFile.name}</span>
                <span className="upload-file-size">{formatFileSize(selectedFile.size)}</span>
              </div>
              {!isUploading && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFile()
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="upload-progress-bar">
                <motion.div
                  className="upload-progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {/* Status */}
            <AnimatePresence>
              {uploadStatus === "success" && (
                <motion.div
                  className="upload-status upload-status--success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <CheckCircle size={16} />
                  <span>Upload complete! Processing document...</span>
                </motion.div>
              )}
              {uploadStatus === "error" && (
                <motion.div
                  className="upload-status upload-status--error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <AlertCircle size={16} />
                  <span>Upload failed. Please try again.</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload Button */}
            {!uploadStatus && (
              <button
                className="btn btn-primary btn-lg upload-submit-btn"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {uploadProgress < 90
                      ? `Uploading ${Math.round(uploadProgress)}%`
                      : "Processing… this may take a few minutes"}
                  </>
                ) : (
                  <>
                    <CloudUpload size={18} />
                    Upload & Process
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="upload-error"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default UploadZone
