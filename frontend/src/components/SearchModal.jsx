import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Search, FileText, X, ArrowRight, Clock } from "lucide-react"
import { getActivities } from "../services/api"

function SearchModal({ onClose }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [allDocs, setAllDocs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [onClose])

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const res = await getActivities()
        const activities = res.data.activities || []
        const uniqueDocs = []
        const seen = new Set()
        for (const act of activities) {
          const key = act.fileName || `doc-${act.id}`
          if (!seen.has(key)) {
            seen.add(key)
            uniqueDocs.push({
              id: act.id,
              name: act.fileName || "Untitled",
              date: act.createdAt,
              action: act.action,
            })
          }
        }
        setAllDocs(uniqueDocs)
        setResults(uniqueDocs.slice(0, 8))
      } catch {
        /* silent */
      } finally {
        setIsLoading(false)
      }
    }
    loadDocs()
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults(allDocs.slice(0, 8))
      return
    }
    const q = query.toLowerCase()
    setResults(
      allDocs
        .filter((doc) => doc.name.toLowerCase().includes(q))
        .slice(0, 8)
    )
  }, [query, allDocs])

  const handleSelect = (doc) => {
    onClose()
    navigate("/history")
  }

  return (
    <AnimatePresence>
      <motion.div
        className="search-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="search-modal glass-card"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="search-modal-input-row">
            <Search size={18} className="search-modal-icon" />
            <input
              ref={inputRef}
              type="text"
              className="search-modal-input"
              placeholder="Search across all documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="search-modal-results">
            {isLoading ? (
              <div className="search-modal-loading">
                <div className="skeleton" style={{ width: "100%", height: 40, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: "100%", height: 40, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: "80%", height: 40 }} />
              </div>
            ) : results.length === 0 ? (
              <div className="search-modal-empty">
                <p>No documents found{query ? ` for "${query}"` : ""}</p>
              </div>
            ) : (
              results.map((doc) => (
                <button
                  key={doc.id}
                  className="search-modal-result-item"
                  onClick={() => handleSelect(doc)}
                >
                  <FileText size={16} className="search-result-icon" />
                  <div className="search-result-info">
                    <span className="search-result-name">{doc.name}</span>
                    <span className="search-result-date">
                      <Clock size={12} />
                      {new Date(doc.date).toLocaleDateString()}
                    </span>
                  </div>
                  <ArrowRight size={14} className="search-result-arrow" />
                </button>
              ))
            )}
          </div>

          <div className="search-modal-footer">
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Open</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default SearchModal
