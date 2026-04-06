import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { downloadWordFile, saveActiveDocument } from "../services/api"

function sanitizeDocumentForAssistant(documentData) {
  if (!documentData || typeof documentData !== "object") {
    return {}
  }

  const images = Array.isArray(documentData.images) ? documentData.images : []

  return {
    pages: Array.isArray(documentData.pages)
      ? documentData.pages.map((page) => ({
          page_number: page?.page_number,
          blocks: Array.isArray(page?.blocks)
            ? page.blocks
                .map((block) => ({
                  text: typeof block?.text === "string" ? block.text : "",
                }))
                .filter((block) => block.text)
            : [],
        }))
      : [],
    tables: Array.isArray(documentData.tables) ? documentData.tables : [],
    images: images.map((image) => {
      if (!image || typeof image !== "object") {
        return image
      }

      const { data_url: _data_url, ...rest } = image
      return rest
    }),
  }
}

function ResultBox({ result, processedFile, documentName, isLoading }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("text")
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState("")

  const payload = result?.data || result
  const extractedImages = Array.isArray(payload?.images) ? payload.images : []
  const assistantDocument = sanitizeDocumentForAssistant(payload)
  const extractedText = Array.isArray(payload?.pages)
    ? payload.pages
        .map((page) => (Array.isArray(page?.blocks) ? page.blocks : []).map((block) => block.text).join("\n"))
        .filter(Boolean)
        .join("\n\n")
    : ""

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
      const contentType =
        response.headers["content-type"] ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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

  const handleTalkWithAI = () => {
    if (!payload) {
      return
    }

    const resolvedDocumentName = documentName || processedFile?.name || "OCR Document"
    saveActiveDocument(resolvedDocumentName, assistantDocument)

    navigate("/ai-chat", {
      state: {
        documentName: resolvedDocumentName,
        documentData: assistantDocument,
      },
    })
  }

  if (isLoading) {
    return (
      <div className="result">
        <div className="resultHeader">
          <div className="skeleton skeleton-title" />
          <div className="resultHeaderActions">
            <div className="skeleton skeleton-btn" />
            <div className="skeleton skeleton-btn" />
          </div>
        </div>
        <div className="result-cards-row">
          <div className="result-card">
            <div className="result-card-header">
              <div className="skeleton skeleton-label" />
            </div>
            <div className="result-card-body">
              <div className="skeleton-img-grid">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="skeleton skeleton-img-card" />
                ))}
              </div>
            </div>
          </div>
          <div className="result-card">
            <div className="result-card-header">
              <div className="skeleton skeleton-label" />
            </div>
            <div className="result-card-body">
              {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                <div
                  key={item}
                  className="skeleton skeleton-line"
                  style={{ width: `${60 + (item % 3) * 15}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="result">
      <div className="resultHeader">
        <h3>OCR Result</h3>
        <div className="resultHeaderActions">
          <button onClick={handleTalkWithAI} className="primaryBtn">
            Talk with AI
          </button>
          <button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Preparing..." : "Download Word"}
          </button>
        </div>
      </div>

      <div className="result-cards-row">
        <div className="result-card">
          <div className="result-card-header">
            <span className="result-card-title">Extracted Images</span>
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
                      Page {image?.page_number || "?"} | {image?.width || "?"}x{image?.height || "?"} |{" "}
                      {image?.extension || "unknown"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="result-card">
          <div className="result-card-header">
            <span className="result-card-title">JSON Output</span>
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
              <pre className="resultPreview">{extractedText || "No text extracted."}</pre>
            ) : (
              <pre className="resultPreview">{JSON.stringify(assistantDocument, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>

      {downloadError && <p className="errorText">{downloadError}</p>}
    </div>
  )
}

export default ResultBox
