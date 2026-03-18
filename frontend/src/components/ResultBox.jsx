import { useState } from "react"
import { downloadWordFile } from "../services/api"

function ResultBox({ result, processedFile, isLoading }) {

  const [activeTab, setActiveTab] = useState("text")
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState("")

  const getFileNameFromDisposition = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)
    return match ? decodeURIComponent(match[1].replace(/"/g, "")) : null
  }

  const handleDownload = async () => {
    if (!processedFile) {
      setDownloadError("Upload a PDF first, then download the Word file.")
      return
    }
    try {
      setIsDownloading(true)
      setDownloadError("")
      const formData = new FormData()
      formData.append("file", processedFile)
      const response = await downloadWordFile(formData)
      const contentType = response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      const disposition = response.headers["content-disposition"]
      const downloadedName = getFileNameFromDisposition(disposition)
      const fallbackName = `${processedFile.name.replace(/\.pdf$/i, "") || "document"}.docx`
      const blob = new Blob([response.data], { type: contentType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = downloadedName || fallbackName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      const apiError = error?.response?.data?.error
      setDownloadError(apiError || "Word download failed. Please try again.")
    } finally {
      setIsDownloading(false)
    }
  }

  // ── Skeleton loading state ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="result">
        <div className="resultHeader">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-btn" />
        </div>
        <div className="result-cards-row">
          {/* Images card skeleton */}
          <div className="result-card">
            <div className="result-card-header">
              <div className="skeleton skeleton-label" />
            </div>
            <div className="result-card-body">
              <div className="skeleton-img-grid">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton skeleton-img-card" />
                ))}
              </div>
            </div>
          </div>
          {/* JSON card skeleton */}
          <div className="result-card">
            <div className="result-card-header">
              <div className="skeleton skeleton-label" />
            </div>
            <div className="result-card-body">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div
                  key={i}
                  className="skeleton skeleton-line"
                  style={{ width: `${60 + (i % 3) * 15}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!result) return null

  const payload = result?.data || result
  const extractedImages = Array.isArray(payload?.images) ? payload.images : []

  const previewPayload = {
    ...payload,
    images: extractedImages.map((image) => {
      const { data_url, ...rest } = image || {}
      return rest
    })
  }

  return (
    <div className="result">
      <div className="resultHeader">
        <h3>OCR Result</h3>
        <button onClick={handleDownload} disabled={isDownloading} title=">>>>>>">
          {isDownloading ? "Preparing..." : "Download Word"}
        </button>
      </div>

      {/* Two-card layout */}
      <div className="result-cards-row">

        {/* ── Images card ── */}
        <div className="result-card">
          <div className="result-card-header">
            <span className="result-card-title">🖼 Extracted Images</span>
            <span className="result-card-count">{extractedImages.length}</span>
          </div>
          <div className="result-card-body">
            {extractedImages.length === 0 ? (
              <p className="fileName">No embedded images found in this PDF.</p>
            ) : (
              <div className="imageGrid">
                {extractedImages.map((image, index) => (
                  <div
                    className="imageCard"
                    key={`${image?.page_number || "page"}-${image?.image_index || index}-${image?.xref || "xref"}`}
                  >
                    {image?.data_url ? (
                      <img
                        src={image.data_url}
                        alt={`Extracted image ${index + 1}`}
                        className="extractedImage"
                        loading="lazy"
                      />
                    ) : (
                      <div className="imageUnavailable">
                        Preview unavailable (image too large)
                      </div>
                    )}
                    <p className="imageMeta">
                      Page {image?.page_number || "?"} | {image?.width || "?"}×{image?.height || "?"} | {image?.extension || "unknown"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── JSON card ── */}
        <div className="result-card">
          <div className="result-card-header">
            <span className="result-card-title"> JSON Output</span>
            <div className="result-tab-group">
              <button
                className={`result-tab ${activeTab === "text" ? "result-tab--active" : ""}`}
                onClick={() => setActiveTab("text")}
              >
                Text
              </button>
              <button
                className={`result-tab ${activeTab === "json" ? "result-tab--active" : ""}`}
                onClick={() => setActiveTab("json")}
              >
                JSON
              </button>
            </div>
          </div>
          <div className="result-card-body result-card-body--code">
            {activeTab === "text" ? (
              <pre className="resultPreview">
                {payload?.pages
                  ?.map(p =>
                    p.blocks?.map(b => b.text).join("\n")
                  )
                  .join("\n\n") || "No text extracted."}
              </pre>
            ) : (
              <pre className="resultPreview">
                {JSON.stringify(previewPayload, null, 2)}
              </pre>
            )}
          </div>
        </div>

      </div>

      {downloadError && <p className="errorText">{downloadError}</p>}
    </div>
  )
}

export default ResultBox
