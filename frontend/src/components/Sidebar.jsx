import { useState, useEffect, useRef } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText, Search, Upload, History, MessageSquare,
  ChevronLeft, ChevronRight, Plus, Trash2, MoreVertical,
  LogOut, Sun, Moon, Sparkles, Edit3, Github, Linkedin,
  Phone, X, ExternalLink
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../contexts/ThemeContext"
import { getActivities, getActivityDetails, deleteActivity, getResultFromCache } from "../services/api"

function getDocumentData(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  if (metadata.documentData && typeof metadata.documentData === "object") return metadata.documentData
  if (Array.isArray(metadata.pages) || Array.isArray(metadata.tables) || Array.isArray(metadata.images)) return metadata
  return null
}

function Sidebar({ isCollapsed, onToggleCollapse }) {
  const { user, logout, isAuthenticated } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [recentDocs, setRecentDocs] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeDocMenu, setActiveDocMenu] = useState(null)
  const [renamingDoc, setRenamingDoc] = useState(null)
  const [renameValue, setRenameValue] = useState("")
  const [showProfile, setShowProfile] = useState(false)
  const [openingDocId, setOpeningDocId] = useState(null)
  const menuRef = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    if (isAuthenticated) fetchRecentDocs()
  }, [isAuthenticated])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setActiveDocMenu(null)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchRecentDocs = async () => {
    try {
      setIsLoading(true)
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
            status: act.status,
            metadata: act.metadata,
          })
        }
        if (uniqueDocs.length >= 15) break
      }
      setRecentDocs(uniqueDocs)
    } catch { /* silent */ } finally { setIsLoading(false) }
  }

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const handleDeleteDoc = async (id) => {
    try {
      await deleteActivity(id)
      setRecentDocs((prev) => prev.filter((d) => d.id !== id))
    } catch { /* silent */ }
    setActiveDocMenu(null)
  }

  const handleRenameDoc = (doc) => {
    setRenamingDoc(doc.id)
    setRenameValue(doc.name)
    setActiveDocMenu(null)
  }

  const handleRenameSubmit = (docId) => {
    if (renameValue.trim()) {
      setRecentDocs((prev) =>
        prev.map((d) => d.id === docId ? { ...d, name: renameValue.trim() } : d)
      )
    }
    setRenamingDoc(null)
    setRenameValue("")
  }

  // Click a sidebar doc -> open it (fetch details and navigate to home with restored state)
  const handleOpenDoc = async (doc) => {
    if (openingDocId) return
    setOpeningDocId(doc.id)
    try {
      const response = await getActivityDetails(doc.id)
      const detail = response.data
      const restoredResult =
        detail.documentData ||
        getDocumentData(doc.metadata) ||
        getResultFromCache(doc.name)?.data

      if (!restoredResult) {
        navigate("/history")
        return
      }

      navigate("/", {
        state: {
          restoredResult,
          restoredFileName: detail.documentName || doc.name,
          restoredTimeline: detail.relatedActivities || [],
          restoredActivityId: detail.sourceActivityId || doc.id,
          canDownloadWordFromHistory: Boolean(detail.availableActions?.canDownloadWord),
        },
      })
    } catch {
      navigate("/history")
    } finally {
      setOpeningDocId(null)
    }
  }

  const filteredDocs = recentDocs.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: "/", icon: Sparkles, label: "Dashboard" },
    { path: "/upload", icon: Upload, label: "Upload" },
    { path: "/history", icon: History, label: "History" },
    { path: "/ai-chat", icon: MessageSquare, label: "AI Chat" },
  ]

  return (
    <motion.aside
      className="sidebar"
      initial={false}
      animate={{ width: isCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Logo */}
      <div className="sidebar-header">
        <Link to="/" state={null} className="sidebar-logo">
          <div className="sidebar-logo-icon"><FileText size={20} /></div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span className="sidebar-logo-text" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }}>
                TextTrack <span className="text-gradient">AI</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button className="btn btn-ghost btn-icon sidebar-collapse-btn" onClick={onToggleCollapse} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* New Document Button */}
      {!isCollapsed && (
        <div className="sidebar-action">
          <button className="btn btn-primary btn-lg sidebar-new-doc-btn" onClick={() => navigate("/")}>
            <Plus size={18} /><span>New Document</span>
          </button>
        </div>
      )}
      {isCollapsed && (
        <div className="sidebar-action sidebar-action--collapsed">
          <button className="btn btn-primary btn-icon" onClick={() => navigate("/")} title="New Document"><Plus size={18} /></button>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className={`sidebar-nav-item ${isActive(item.path) ? "sidebar-nav-item--active" : ""}`} title={isCollapsed ? item.label : undefined}>
            <item.icon size={18} />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>{item.label}</motion.span>
              )}
            </AnimatePresence>
            {isActive(item.path) && (
              <motion.div className="sidebar-nav-indicator" layoutId="sidebar-indicator" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
            )}
          </Link>
        ))}
      </nav>

      {/* Search + Recent Documents */}
      {!isCollapsed && isAuthenticated && (
        <div className="sidebar-documents">
          <div className="sidebar-search">
            <Search size={14} className="sidebar-search-icon" />
            <input type="text" className="sidebar-search-input" placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div className="sidebar-section-title">Recent Documents</div>
          <div className="sidebar-doc-list">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="sidebar-doc-skeleton"><div className="skeleton" style={{ width: "100%", height: 32 }} /></div>
              ))
            ) : filteredDocs.length === 0 ? (
              <p className="sidebar-empty">{searchQuery ? "No results" : "No documents yet"}</p>
            ) : (
              filteredDocs.map((doc) => (
                <div key={doc.id} className="sidebar-doc-item" style={{ position: "relative" }}>
                  {renamingDoc === doc.id ? (
                    <form className="sidebar-rename-form" onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(doc.id) }}>
                      <input
                        className="sidebar-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        onBlur={() => handleRenameSubmit(doc.id)}
                        onKeyDown={(e) => { if (e.key === "Escape") { setRenamingDoc(null) } }}
                      />
                    </form>
                  ) : (
                    <>
                      <div
                        className="sidebar-doc-clickable"
                        onClick={() => handleOpenDoc(doc)}
                        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1, minWidth: 0, cursor: "pointer" }}
                      >
                        <FileText size={14} className="sidebar-doc-icon" />
                        <span className="sidebar-doc-name truncate">
                          {openingDocId === doc.id ? "Opening..." : doc.name}
                        </span>
                      </div>
                      <button
                        className="sidebar-doc-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveDocMenu(activeDocMenu === doc.id ? null : doc.id)
                        }}
                        title="Options"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </>
                  )}

                  {/* Dropdown menu */}
                  <AnimatePresence>
                    {activeDocMenu === doc.id && (
                      <motion.div
                        ref={menuRef}
                        className="sidebar-doc-dropdown surface-card"
                        initial={{ opacity: 0, scale: 0.9, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -5 }}
                        transition={{ duration: 0.15 }}
                      >
                        <button className="sidebar-dropdown-item" onClick={() => handleRenameDoc(doc)}>
                          <Edit3 size={13} /> Rename
                        </button>
                        <button className="sidebar-dropdown-item sidebar-dropdown-item--danger" onClick={() => handleDeleteDoc(doc.id)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-footer-btn" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {!isCollapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {isAuthenticated && (
          <div className="sidebar-user" style={{ position: "relative" }}>
            <div
              className="sidebar-user-clickable"
              onClick={() => setShowProfile(!showProfile)}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", cursor: "pointer", flex: 1, minWidth: 0 }}
            >
              <div className="sidebar-user-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              {!isCollapsed && (
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name truncate">{user?.name || "User"}</span>
                  <span className="sidebar-user-email truncate">{user?.email || ""}</span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={handleLogout} title="Logout">
                <LogOut size={16} />
              </button>
            )}

            {/* Profile Popup */}
            <AnimatePresence>
              {showProfile && !isCollapsed && (
                <motion.div
                  ref={profileRef}
                  className="sidebar-profile-popup glass-card"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <button className="sidebar-profile-close" onClick={() => setShowProfile(false)}>
                    <X size={14} />
                  </button>

                  <div className="sidebar-profile-header">
                    <div className="sidebar-profile-avatar">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <h4 className="sidebar-profile-name">{user?.name || "User"}</h4>
                    <p className="sidebar-profile-email">{user?.email || ""}</p>
                  </div>

                  <div className="sidebar-profile-divider" />

                  <div className="sidebar-profile-info">
                    <div className="sidebar-profile-row">
                      <span>Version</span>
                      <span className="badge badge-primary">V1</span>
                    </div>
                    <div className="sidebar-profile-row">
                      <span>Made by</span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Deepak</span>
                    </div>
                  </div>

                  <div className="sidebar-profile-divider" />

                  <div className="sidebar-profile-links">
                    <a href="https://linkedin.com/in/deepak" target="_blank" rel="noopener noreferrer" className="sidebar-profile-link">
                      <Linkedin size={16} /> LinkedIn
                      <ExternalLink size={12} style={{ marginLeft: "auto" }} />
                    </a>
                    <a href="https://github.com/deepak" target="_blank" rel="noopener noreferrer" className="sidebar-profile-link">
                      <Github size={16} /> GitHub
                      <ExternalLink size={12} style={{ marginLeft: "auto" }} />
                    </a>
                    <a href="tel:+91XXXXXXXXXX" className="sidebar-profile-link">
                      <Phone size={16} /> Contact
                      <ExternalLink size={12} style={{ marginLeft: "auto" }} />
                    </a>
                  </div>

                  <div className="sidebar-profile-divider" />

                  <button className="sidebar-profile-logout" onClick={handleLogout}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  )
}

export default Sidebar
