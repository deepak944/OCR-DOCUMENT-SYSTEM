import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  downloadExcelExport,
  downloadWordFile,
  downloadWordExport,
  downloadWordFromHistory,
  saveActiveDocument,
  downloadCadExport,
} from "../services/api"


function sanitizeDocumentForAssistant(documentData) {
  if (!documentData || typeof documentData !== "object") {
    return {}
  }

  const images = Array.isArray(documentData.images) ? documentData.images : []

  return {
    pages: Array.isArray(documentData.pages)
      ? documentData.pages.map((page) => ({
          page_number: page?.page_number,
          text: typeof page?.text === "string" ? page.text : "",
          blocks: Array.isArray(page?.blocks)
            ? page.blocks
                .map((block) => ({
                  text: typeof block?.text === "string" ? block.text : "",
                }))
                .filter((block) => block.text)
            : [],
          tables: Array.isArray(page?.tables) ? page.tables : [],
          metadata: page?.metadata && typeof page.metadata === "object" ? page.metadata : {},
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
    metadata: documentData.metadata && typeof documentData.metadata === "object" ? documentData.metadata : {},
  }
}

function sanitizeDocumentForDisplay(documentData) {
  if (!documentData || typeof documentData !== "object") {
    return {}
  }

  return JSON.parse(
    JSON.stringify(documentData, (key, value) => {
      if (key === "data_url" && typeof value === "string" && value) {
        return "[inline image preview available in the Images panel]"
      }

      return value
    })
  )
}

function getPageText(page) {
  const blockText = Array.isArray(page?.blocks)
    ? page.blocks
        .map((block) => String(block?.text || "").trim())
        .filter(Boolean)
        .join("\n")
    : ""

  return blockText || String(page?.text || "").trim()
}

function buildRestoredChatMessages(restoredTimeline) {
  if (!Array.isArray(restoredTimeline)) {
    return []
  }

  return restoredTimeline
    .filter((entry) => entry?.action === "AI_CHAT" && (entry.prompt || entry.response))
    .flatMap((entry) => {
      const messages = []

      if (entry.prompt) {
        messages.push({
          id: `restored-user-${entry.id}`,
          role: "user",
          content: entry.prompt,
        })
      }

      if (entry.response) {
        messages.push({
          id: `restored-assistant-${entry.id}`,
          role: "assistant",
          content: entry.response,
        })
      }

      return messages
    })
}

async function getDownloadErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data

  if (responseData instanceof Blob) {
    try {
      const text = await responseData.text()
      const parsed = JSON.parse(text)
      return parsed?.error || parsed?.detail || fallbackMessage
    } catch {
      return fallbackMessage
    }
  }

  return responseData?.error || responseData?.detail || fallbackMessage
}

function ResultBox({
  result,
  processedFile,
  documentName,
  isLoading,
  restoredTimeline = [],
  restoredActivityId = null,
  canDownloadWordFromHistory = false,
}) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("text")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false)
  const [isDownloadingCad, setIsDownloadingCad] = useState(false)
  const [downloadError, setDownloadError] = useState("")


  const payload = result?.data || result
  const extractedImages = Array.isArray(payload?.images) ? payload.images : []
  const assistantDocument = sanitizeDocumentForAssistant(payload)
  const displayDocument = sanitizeDocumentForDisplay(payload)
  const extractedText = Array.isArray(payload?.pages)
    ? payload.pages
        .map((page) => getPageText(page))
        .filter(Boolean)
        .join("\n\n")
    : ""

  const getTimelineLabel = (action) => {
    const labels = {
      OCR_PROCESS: "OCR Processing",
      WORD_EXPORT: "Word Export",
      EXCEL_EXPORT: "Excel Export",
      AI_CHAT: "AI Chat",
    }

    return labels[action] || action
  }

  const getFileNameFromDisposition = (contentDisposition) => {
    if (!contentDisposition) return null
    const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)
    return match ? decodeURIComponent(match[1].replace(/"/g, "")) : null
  }

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      setDownloadError("")

      let response
      const resolvedDocumentName = documentName || processedFile?.name || "OCR Document"
      let fallbackName = `${resolvedDocumentName.replace(/\.pdf$/i, "") || "document"}.docx`

      if (payload) {
        response = await downloadWordExport(payload, resolvedDocumentName)
      } else if (processedFile) {
        try {
          const formData = new FormData()
          formData.append("file", processedFile)
          response = await downloadWordFile(formData)
          fallbackName = `${processedFile.name.replace(/\.pdf$/i, "") || "document"}.docx`
        } catch {
          throw new Error("Word download failed. Please upload the PDF again and try once more.")
        }
      } else if (canDownloadWordFromHistory && restoredActivityId) {
        response = await downloadWordFromHistory(restoredActivityId)
      } else {
        throw new Error("Word download needs either saved OCR data or the original PDF. Please upload the PDF again and try once more.")
      }

      const contentType =
        response.headers["content-type"] ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      const disposition = response.headers["content-disposition"]
      const downloadedName = getFileNameFromDisposition(disposition)
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
      const apiError = await getDownloadErrorMessage(error, error?.message || "Word download failed. Please try again.")
      setDownloadError(apiError)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleExcelDownload = async () => {
    if (!payload) {
      setDownloadError("Upload a PDF first, then download the Excel file.")
      return
    }

    try {
      setIsDownloadingExcel(true)
      setDownloadError("")

      const resolvedDocumentName = documentName || processedFile?.name || "OCR Document"
      const response = await downloadExcelExport(payload, resolvedDocumentName)
      const contentType =
        response.headers["content-type"] ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      const disposition = response.headers["content-disposition"]
      const downloadedName = getFileNameFromDisposition(disposition)
      const fallbackName = `${resolvedDocumentName.replace(/\.pdf$/i, "") || "document"}.xlsx`
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
      const apiError = await getDownloadErrorMessage(error, "Excel download failed. Please try again.")
      setDownloadError(apiError)
    } finally {
      setIsDownloadingExcel(false)
    }
  }

  const handleCadDownload = async () => {
    if (!payload) {
      setDownloadError("Upload a PDF first, then download the AutoCAD file.")
      return
    }

    try {
      setIsDownloadingCad(true)
      setDownloadError("")

      const resolvedDocumentName = documentName || processedFile?.name || "OCR Document"
      const response = await downloadCadExport(payload, resolvedDocumentName)
      const contentType = response.headers["content-type"] || "image/vnd.dxf"
      const disposition = response.headers["content-disposition"]
      const downloadedName = getFileNameFromDisposition(disposition)
      const fallbackName = `${resolvedDocumentName.replace(/\.pdf$/i, "") || "document"}.dxf`
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
      const apiError = await getDownloadErrorMessage(error, "AutoCAD DXF download failed. Please try again.")
      setDownloadError(apiError)
    } finally {
      setIsDownloadingCad(false)
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
        restoredMessages: buildRestoredChatMessages(restoredTimeline),
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

  const hasRestoredTimeline = Array.isArray(restoredTimeline) && restoredTimeline.length > 0

  return (
    <div className="result">
      <div className="resultHeader">
        <h3>OCR Result</h3>
        <div className="resultHeaderActions">
          <button onClick={handleTalkWithAI} className="primaryBtn">
            Talk with AI
          </button>
          <button onClick={handleCadDownload} disabled={isDownloadingCad} className="cadBtn">
            {isDownloadingCad ? "Preparing CAD..." : "Download CAD"}
          </button>
          <button onClick={handleExcelDownload} disabled={isDownloadingExcel}>
            {isDownloadingExcel ? "Preparing Excel..." : "Download Excel"}
          </button>
          <button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Preparing..." : "Download Word"}
          </button>
        </div>

      </div>

      {hasRestoredTimeline && (
        <div className="restored-session-panel">
          <div className="restored-session-header">
            <strong>Restored session history</strong>
            <span>{restoredTimeline.length} saved actions</span>
          </div>
          <div className="restored-session-list">
            {restoredTimeline.map((entry) => (
              <div key={entry.id} className="restored-session-item">
                <div>
                  <strong>{getTimelineLabel(entry.action)}</strong>
                  {entry.summary && <p>{entry.summary}</p>}
                  {entry.prompt && <p className="restored-session-chat">You: {entry.prompt}</p>}
                  {entry.response && <p className="restored-session-chat">AI: {entry.response}</p>}
                </div>
                <span className={`status-badge status-${entry.status}`}>{entry.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <pre className="resultPreview">{JSON.stringify(displayDocument, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>

      {downloadError && <p className="errorText">{downloadError}</p>}
    </div>
  )
}

export default ResultBox
