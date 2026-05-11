import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import {
  Send, Trash2, Copy, Check, RotateCcw, Sparkles, FileText,
  Loader2, Mic, MicOff, StopCircle, Table, Globe, Mail, ChevronDown
} from "lucide-react"
import {
  chatWithDocument,
  downloadExcelExport,
  getActiveDocument,
  saveActiveDocument,
} from "../services/api"

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, label: "Summarize", prompt: "Summarize this document in detail." },
  { icon: Table, label: "Extract Tables", prompt: "Extract all tables from this document." },
  { icon: Globe, label: "Translate", prompt: "Translate the key content of this document to Hindi." },
  { icon: Mail, label: "Find Emails", prompt: "Find all email addresses mentioned in this document." },
]

function getDownloadName(contentDisposition, fallbackName) {
  if (!contentDisposition) return fallbackName
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

function ChatInterface() {
  const location = useLocation()
  const chatEndRef = useRef(null)
  const textareaRef = useRef(null)
  const [documentData, setDocumentData] = useState(null)
  const [documentName, setDocumentName] = useState("OCR Document")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [error, setError] = useState("")
  const [copiedId, setCopiedId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const activeDocument = location.state?.documentData
      ? {
          documentData: location.state.documentData,
          documentName: location.state.documentName || "OCR Document",
          restoredMessages: Array.isArray(location.state.restoredMessages)
            ? location.state.restoredMessages
            : [],
        }
      : getActiveDocument()

    if (!activeDocument?.documentData) {
      setDocumentData(null)
      return
    }

    setDocumentData(activeDocument.documentData)
    setDocumentName(activeDocument.documentName || "OCR Document")
    saveActiveDocument(activeDocument.documentName, activeDocument.documentData)

    const restoredMessages = Array.isArray(activeDocument.restoredMessages)
      ? activeDocument.restoredMessages
      : []
    setMessages([
      {
        id: `assistant-ready-${Date.now()}`,
        role: "assistant",
        content: `I've loaded **${activeDocument.documentName || "your document"}**. Ask me anything about it — I can summarize, extract data, translate, and more.`,
        timestamp: Date.now(),
      },
      ...restoredMessages,
    ])
    setError("")
    setInput("")
  }, [location.state])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px"
    }
  }, [input])

  const appendAssistantMessage = (content) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content,
        timestamp: Date.now(),
      },
    ])
  }

  const handleExcelExport = async (requestedByUser) => {
    if (!documentData || isExportingExcel) return
    setError("")
    setIsExportingExcel(true)
    try {
      const response = await downloadExcelExport(documentData, documentName)
      const fallbackName = `${documentName.replace(/\.pdf$/i, "") || "ocr-document"}.xlsx`
      const fileName = getDownloadName(response.headers["content-disposition"], fallbackName)
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      triggerBrowserDownload(blob, fileName)
      appendAssistantMessage(
        requestedByUser
          ? `✅ Excel workbook for **${documentName}** is ready. The download should start automatically.`
          : `✅ Excel export for **${documentName}** is downloading now.`
      )
    } catch (err) {
      const apiError = err?.response?.data?.error
      setError(apiError || "Excel export failed. Please try again.")
    } finally {
      setIsExportingExcel(false)
    }
  }

  const sendMessage = async (messageText) => {
    const trimmed = messageText.trim()
    if (!trimmed || !documentData || isSending || isExportingExcel) return

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setError("")

    if (isExcelRequest(trimmed)) {
      await handleExcelExport(true)
      return
    }

    setIsSending(true)
    try {
      const conversationHistory = [...messages, userMessage]
        .filter((e) => e.role === "user" || e.role === "assistant")
        .map((e) => ({ role: e.role, content: e.content }))

      const response = await chatWithDocument(
        trimmed,
        documentData,
        conversationHistory,
        documentName
      )
      appendAssistantMessage(response.data.response)
    } catch (err) {
      const apiError = err?.response?.data?.error
      setError(apiError || "AI request failed. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleCopy = async (content, id) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      /* silent */
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: `assistant-cleared-${Date.now()}`,
        role: "assistant",
        content: "Chat cleared. Ask me anything about your document.",
        timestamp: Date.now(),
      },
    ])
  }

  // Voice input
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setError("Voice input is not supported in this browser.")
      return
    }
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("")
      setInput(transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const isBusy = isSending || isExportingExcel
  const showSuggestions = messages.length <= 1 && documentData

  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "")
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{
            borderRadius: "8px",
            fontSize: "0.8125rem",
            margin: "0.5rem 0",
          }}
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      ) : (
        <code className="chat-inline-code" {...props}>
          {children}
        </code>
      )
    },
    table({ children }) {
      return (
        <div className="chat-table-wrapper">
          <table className="chat-table">{children}</table>
        </div>
      )
    },
  }

  if (!documentData) {
    return (
      <div className="chat-empty-state">
        <motion.div
          className="chat-empty-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="chat-empty-icon">
            <FileText size={48} />
          </div>
          <h2>No document loaded</h2>
          <p>Upload a PDF and open "Talk with AI" from the OCR result to start chatting.</p>
          <Link to="/" className="btn btn-primary btn-lg">
            Go to Dashboard
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <FileText size={18} />
          <span className="chat-header-doc-name truncate">{documentName}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleClearChat}>
          <Trash2 size={14} />
          <span>Clear</span>
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {/* Suggested Prompts */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              className="chat-suggestions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <p className="chat-suggestions-label">💡 Try asking:</p>
              <div className="chat-suggestions-grid">
                {SUGGESTED_PROMPTS.map((sp) => (
                  <button
                    key={sp.label}
                    className="chat-suggestion-btn surface-card"
                    onClick={() => sendMessage(sp.prompt)}
                    disabled={isBusy}
                  >
                    <sp.icon size={16} />
                    <span>{sp.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message List */}
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            className={`chat-message chat-message--${msg.role}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.02 }}
          >
            <div className="chat-message-avatar">
              {msg.role === "assistant" ? (
                <div className="chat-avatar chat-avatar--ai">
                  <Sparkles size={14} />
                </div>
              ) : (
                <div className="chat-avatar chat-avatar--user">
                  U
                </div>
              )}
            </div>
            <div className="chat-message-content">
              <div className="chat-message-header">
                <span className="chat-message-role">
                  {msg.role === "assistant" ? "TextTrack AI" : "You"}
                </span>
                <span className="chat-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="chat-message-body">
                {msg.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === "assistant" && (
                <div className="chat-message-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleCopy(msg.content, msg.id)}
                    title="Copy"
                  >
                    {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing Indicator */}
        <AnimatePresence>
          {isBusy && (
            <motion.div
              className="chat-message chat-message--assistant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="chat-message-avatar">
                <div className="chat-avatar chat-avatar--ai">
                  <Sparkles size={14} />
                </div>
              </div>
              <div className="chat-message-content">
                <div className="chat-typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="chat-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form className="chat-input-area" onSubmit={handleSubmit}>
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Ask anything about this document..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isBusy}
          />
          <div className="chat-input-actions">
            <button
              type="button"
              className={`btn btn-ghost btn-icon btn-sm ${isListening ? "chat-mic-active" : ""}`}
              onClick={toggleVoice}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-icon btn-sm chat-send-btn"
              disabled={isBusy || !input.trim()}
            >
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
        <div className="chat-input-hint">
          <span>Enter to send · Shift+Enter for new line</span>
          <span className="chat-char-count">{input.length}/2000</span>
        </div>
      </form>
    </div>
  )
}

export default ChatInterface
