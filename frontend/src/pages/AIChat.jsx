import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import Navbar from "../components/Navbar"
import {
  chatWithDocument,
  downloadExcelExport,
  getActiveDocument,
  saveActiveDocument,
} from "../services/api"

const QUICK_ACTIONS = [
  { label: "Summarize this document", type: "chat", prompt: "Summarize this document." },
  { label: "Extract key information", type: "chat", prompt: "Extract the key information from this document." },
  { label: "Download Excel", type: "excel" },
]

function getDownloadName(contentDisposition, fallbackName) {
  if (!contentDisposition) {
    return fallbackName
  }

  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)
  return match ? decodeURIComponent(match[1].replace(/"/g, "")) : fallbackName
}

function triggerBrowserDownload(blob, fileName) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function isExcelRequest(message) {
  return /\b(excel|xlsx|spreadsheet|sheet|export to excel|download excel)\b/i.test(message)
}

function AIChat() {
  const location = useLocation()
  const chatEndRef = useRef(null)
  const [documentData, setDocumentData] = useState(null)
  const [documentName, setDocumentName] = useState("OCR Document")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Ask anything about your uploaded document. I will use the current PDF for document questions, and I can also answer general questions when they are outside the document.",
    },
  ])
  const [isSending, setIsSending] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const activeDocument = location.state?.documentData
      ? {
          documentData: location.state.documentData,
          documentName: location.state.documentName || "OCR Document",
        }
      : getActiveDocument()

    if (!activeDocument?.documentData) {
      setDocumentData(null)
      return
    }

    setDocumentData(activeDocument.documentData)
    setDocumentName(activeDocument.documentName || "OCR Document")
    saveActiveDocument(activeDocument.documentName, activeDocument.documentData)
    setMessages([
      {
        id: `assistant-ready-${Date.now()}`,
        role: "assistant",
        content: `Current document loaded: ${activeDocument.documentName || "OCR Document"}. I will use this PDF for document questions, and I can still answer general questions when needed.`,
      },
    ])
    setError("")
    setInput("")
  }, [location.state])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending, isExportingExcel])

  const appendAssistantMessage = (content) => {
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content,
      },
    ])
  }

  const handleExcelExport = async (requestedByUserMessage) => {
    if (!documentData || isExportingExcel) {
      return
    }

    setError("")
    setIsExportingExcel(true)

    try {
      const response = await downloadExcelExport(documentData, documentName)
      const fallbackName = `${documentName.replace(/\.pdf$/i, "") || "ocr-document"}.xlsx`
      const fileName = getDownloadName(response.headers["content-disposition"], fallbackName)
      const blob = new Blob([response.data], {
        type:
          response.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      triggerBrowserDownload(blob, fileName)

      appendAssistantMessage(
        requestedByUserMessage
          ? `I prepared an Excel workbook for ${documentName}. The download should start automatically and you can open it in Excel.`
          : `Excel export for ${documentName} is ready. The download should start automatically and open in Excel when you open the file.`
      )
    } catch (requestError) {
      const apiError = requestError?.response?.data?.error
      setError(apiError || "Excel export failed. Please try again.")
    } finally {
      setIsExportingExcel(false)
    }
  }

  const sendMessage = async (messageText) => {
    const trimmedMessage = messageText.trim()

    if (!trimmedMessage || !documentData || isSending || isExportingExcel) {
      return
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
    }

    setMessages((current) => [...current, userMessage])
    setInput("")
    setError("")

    if (isExcelRequest(trimmedMessage)) {
      await handleExcelExport(true)
      return
    }

    setIsSending(true)

    try {
      const conversationHistory = [...messages, userMessage]
        .filter((entry) => entry.role === "user" || entry.role === "assistant")
        .map((entry) => ({
          role: entry.role,
          content: entry.content,
        }))

      const response = await chatWithDocument(
        trimmedMessage,
        documentData,
        conversationHistory,
        documentName
      )

      appendAssistantMessage(response.data.response)
    } catch (requestError) {
      const apiError = requestError?.response?.data?.error
      setError(apiError || "AI assistant request failed. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await sendMessage(input)
  }

  const handleQuickAction = async (action) => {
    if (action.type === "excel") {
      await handleExcelExport(false)
      return
    }

    await sendMessage(action.prompt)
  }

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void sendMessage(input)
    }
  }

  const isBusy = isSending || isExportingExcel

  return (
    <>
      <Navbar />
      <main className="pageShell pageShell--wide">
        <section className="card chatCard">
          <div className="chatPageHeader">
            <div>
              <h1 className="cardTitle">AI Document Assistant</h1>
              <p className="cardSubtitle">
                Talk with your OCR result with AI assistance.
              </p>
            </div>
            <div className="chatDocumentBadge">{documentName}</div>
          </div>

          {!documentData ? (
            <div className="chatEmptyState">
              <h2>No OCR document loaded</h2>
              <p>Upload a PDF and open Talk with AI from the OCR result to start chatting.</p>
              <Link to="/" className="nav-link">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <>
              <div className="quickActions">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="quickActionBtn"
                    onClick={() => handleQuickAction(action)}
                    disabled={isBusy}
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              <div className="chatThread">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chatMessage chatMessage--${message.role}`}
                  >
                    <span className="chatRoleLabel">
                      {message.role === "assistant" ? "AI" : "You"}
                    </span>
                    <pre className="chatMessageText">{message.content}</pre>
                  </div>
                ))}

                {isBusy && (
                  <div className="chatMessage chatMessage--assistant">
                    <span className="chatRoleLabel">AI</span>
                    <div className="chatTyping">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {error && <p className="errorText">{error}</p>}

              <form className="chatComposer" onSubmit={handleSubmit}>
                <textarea
                  className="chatInput"
                  placeholder="Ask a question about this document or request an Excel export..."
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={4}
                  disabled={isBusy}
                />
                <div className="chatComposerFooter">
                  <span className="chatHint">
                    Press Enter to send. Ask for Excel to download a workbook from this uploaded PDF.
                  </span>
                  <button type="submit" className="primaryBtn" disabled={isBusy || !input.trim()}>
                    {isExportingExcel ? "Preparing Excel..." : isSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </main>
    </>
  )
}

export default AIChat
