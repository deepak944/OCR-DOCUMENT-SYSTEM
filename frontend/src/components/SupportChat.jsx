import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, X, Send, Phone, ArrowLeft, Shield, Sparkles } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { db } from "../firebase"
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore"

function SupportChat({ isOpen, onClose }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !user?.uid) return

    // Query messages in real-time from Firestore support channel
    const messagesRef = collection(db, "support_chats", user.uid, "messages")
    const q = query(messagesRef, orderBy("createdAt", "asc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = []
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() })
      })
      setMessages(msgs)
    }, (error) => {
      console.error("Firestore onSnapshot error:", error)
    })

    return () => unsubscribe()
  }, [isOpen, user?.uid])

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || !user?.uid) return

    const userMessage = inputValue.trim()
    setInputValue("")

    try {
      // 1. Add user message to Firestore
      const messagesRef = collection(db, "support_chats", user.uid, "messages")
      await addDoc(messagesRef, {
        text: userMessage,
        senderId: user.uid,
        senderName: user.displayName || user.name || "User",
        senderEmail: user.email,
        isAdmin: false,
        createdAt: serverTimestamp(),
      })

      // 2. Simulate professional support operator response if first message or general inquiry
      if (messages.length <= 1) {
        setIsTyping(true)
        setTimeout(async () => {
          await addDoc(messagesRef, {
            text: `Thanks for reaching out, ${user.displayName || user.name || "there"}! A support representative has been notified of your inquiry. In the meantime, feel free to share any details, screenshots, or files regarding your issue!`,
            senderId: "support_operator",
            senderName: "Deepak (Support Tech)",
            isAdmin: true,
            createdAt: serverTimestamp(),
          })
          setIsTyping(false)
        }, 1500)
      }
    } catch (err) {
      console.error("Failed to save message to Firestore support:", err)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="support-chat-window glass-card"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Support Chat Header */}
        <div className="support-chat-header">
          <div className="support-chat-avatar">
            <Sparkles size={16} className="text-brand" />
          </div>
          <div className="support-chat-header-info">
            <h4>Live Support Channel</h4>
            <div className="support-status">
              <span className="status-dot"></span>
              <span>Online • Deepak (Support)</span>
            </div>
          </div>
          <button className="support-close-btn" onClick={onClose} aria-label="Close support chat">
            <X size={16} />
          </button>
        </div>

        {/* Support Safety Banner */}
        <div className="support-chat-banner">
          <Shield size={12} />
          <span>Real-time support secured via Google Firestore</span>
        </div>

        {/* Support Messages List */}
        <div className="support-messages-container">
          {messages.length === 0 ? (
            <div className="support-chat-empty">
              <MessageCircle size={32} className="empty-icon" />
              <h5>Start a Support Chat</h5>
              <p>Type a message below to connect directly with the TextTrack AI support team in real-time.</p>
            </div>
          ) : (
            <div className="support-messages-list">
              <div className="support-system-msg">
                Chat initialized. Channel ID: {user?.uid?.substring(0, 8)}...
              </div>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`support-message-wrapper ${msg.isAdmin ? "support-msg--admin" : "support-msg--user"}`}
                >
                  <div className="support-message-bubble">
                    <span className="support-message-sender">{msg.isAdmin ? "Support Representative" : "You"}</span>
                    <p className="support-message-text">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="support-message-wrapper support-msg--admin">
                  <div className="support-message-bubble support-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Support Form Input */}
        <form className="support-chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="support-chat-input"
            placeholder="Type your support request..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className="support-send-btn" disabled={!inputValue.trim()}>
            <Send size={14} />
          </button>
        </form>
      </motion.div>
    </AnimatePresence>
  )
}

export default SupportChat
