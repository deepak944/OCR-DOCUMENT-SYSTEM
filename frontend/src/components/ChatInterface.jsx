import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import {
  Send, Trash2, Copy, Check, RotateCcw, Sparkles, FileText,
  Loader2, Mic, MicOff, StopCircle, Table, Globe, Mail, ChevronDown,
  MessageSquare, BrainCircuit
} from "lucide-react"
import {
  chatWithDocument,
  downloadExcelExport,
  getActiveDocument,
  saveActiveDocument,
} from "../services/api"

const getLanguageName = (code) => {
  const map = {
    en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", bn: "Bengali",
    mr: "Marathi", gu: "Gujarati", kn: "Kannada", ml: "Malayalam",
    pa: "Punjabi", ur: "Urdu", ar: "Arabic", zh: "Chinese", ja: "Japanese",
    ko: "Korean", fr: "French", de: "German", es: "Spanish", pt: "Portuguese",
    ru: "Russian"
  };
  return map[code] || "English";
};

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

  // Determine chat mode: "document" when navigated with document data, "general" otherwise
  const hasDocumentFromNav = Boolean(location.state?.documentData)
  const chatMode = documentData ? "document" : "general"

  const currentLangCode = localStorage.getItem("texttrack-lang") || "en";
  const currentLangName = getLanguageName(currentLangCode);

  // Different prompts for document mode vs general mode
  const DOCUMENT_PROMPTS = [
    { icon: Sparkles, label: "Summarize", prompt: `Summarize the key points of this document in ${currentLangName}.` },
    { icon: Table, label: "Extract Tables", prompt: "Extract and format all tables found in this document." },
    { icon: Globe, label: "Translate", prompt: `Translate the main content of this document to ${currentLangName}.` },
    { icon: Mail, label: "Key Entities", prompt: "List all names, dates, emails, and important entities found in this document." },
  ];

  const GENERAL_PROMPTS = [
    { icon: BrainCircuit, label: "Explain OCR", prompt: "What is OCR and how does it work?" },
    { icon: Sparkles, label: "Write Code", prompt: "Write a Python script to extract text from a PDF file." },
    { icon: Globe, label: "Translate", prompt: `How do you say 'document processing' in ${currentLangName}?` },
    { icon: MessageSquare, label: "Help Me", prompt: "What can you help me with?" },
  ];

  const SUGGESTED_PROMPTS = chatMode === "document" ? DOCUMENT_PROMPTS : GENERAL_PROMPTS;

  useEffect(() => {
    // ONLY load document if explicitly passed via navigation state (Talk with AI button)
    // Do NOT fall back to localStorage — sidebar AI Chat should be clean/general
    if (location.state?.documentData) {
      const docData = location.state.documentData
      const docName = location.state.documentName || "OCR Document"
      const restoredMsgs = Array.isArray(location.state.restoredMessages)
        ? location.state.restoredMessages
        : []

      setDocumentData(docData)
      setDocumentName(docName)
      saveActiveDocument(docName, docData)

      setMessages([
        {
          id: `assistant-ready-${Date.now()}`,
          role: "assistant",
          content: `I've loaded **${docName}**. Ask me anything about it — I can summarize, extract data, translate, and more.\n\n> 📄 This chat is scoped to this document only. I'll answer from the document content.`,
          timestamp: Date.now(),
        },
        ...restoredMsgs,
      ])
      setError("")
      setInput("")
    } else {
      // General mode — no document loaded, clean chat
      setDocumentData(null)
      setDocumentName("OCR Document")
      setMessages([
        {
          id: `assistant-welcome-${Date.now()}`,
          role: "assistant",
          content: `Hi! I'm **TextTrack AI** — your intelligent assistant. 🤖\n\nYou can ask me anything — general knowledge, coding help, explanations, and more.\n\n> 💡 **Tip:** To chat about a specific document, upload a PDF first and click **"Talk with AI"** from the OCR result.`,
          timestamp: Date.now(),
        },
      ])
      setError("")
      setInput("")
    }
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
      // Get language from localStorage
      const language = localStorage.getItem("texttrack-lang") || "en"
      
      const response = await downloadExcelExport(documentData, documentName, language)
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
    if (!trimmed || isSending || isExportingExcel) return

    // In document mode, require documentData
    // In general mode, allow sending without documentData

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setError("")

    // Excel export only in document mode
    if (documentData && isExcelRequest(trimmed)) {
      await handleExcelExport(true)
      return
    }

    setIsSending(true)
    try {
      const conversationHistory = [...messages, userMessage]
        .filter((e) => e.role === "user" || e.role === "assistant")
        .map((e) => ({ role: e.role, content: e.content }))

      // Get language from localStorage
      const language = localStorage.getItem("texttrack-lang") || "en"

      // In general mode, send empty/null documentData — backend already supports this
      const response = await chatWithDocument(
        trimmed,
        documentData || {},
        conversationHistory,
        documentData ? documentName : "General Chat",
        language
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
    if (chatMode === "document") {
      setMessages([
        {
          id: `assistant-cleared-${Date.now()}`,
          role: "assistant",
          content: "Chat cleared. Ask me anything about your document.",
          timestamp: Date.now(),
        },
      ])
    } else {
      setMessages([
        {
          id: `assistant-cleared-${Date.now()}`,
          role: "assistant",
          content: "Chat cleared. Ask me anything!",
          timestamp: Date.now(),
        },
      ])
    }
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
  const showSuggestions = messages.length <= 1

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

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          {chatMode === "document" ? (
            <>
              <FileText size={18} />
              <span className="chat-header-doc-name truncate">{documentName}</span>
              <span className="chat-mode-badge chat-mode-badge--doc">Document Mode</span>
            </>
          ) : (
            <>
              <BrainCircuit size={18} />
              <span className="chat-header-doc-name">TextTrack AI Assistant</span>
              <span className="chat-mode-badge chat-mode-badge--general">General Mode</span>
            </>
          )}
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
            placeholder={chatMode === "document" ? "Ask anything about this document..." : "Ask me anything..."}
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
