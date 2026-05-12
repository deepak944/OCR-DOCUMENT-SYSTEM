import { useState, useEffect } from "react"
import { useLocation, Link } from "react-router-dom"
import { Menu, Search, Globe } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import SearchModal from "./SearchModal"

const ROUTE_LABELS = {
  "/": "Dashboard",
  "/upload": "Upload Document",
  "/history": "History",
  "/ai-chat": "AI Chat",
  "/login": "Sign In",
  "/register": "Create Account",
  "/forgot-password": "Forgot Password",
  "/reset-password": "Reset Password",
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml", label: "മലയാളം (Malayalam)" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ur", label: "اردو (Urdu)" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "fr", label: "Français (French)" },
  { code: "de", label: "Deutsch (German)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "ru", label: "Русский (Russian)" },
]

function TopBar({ onMenuClick, isMobile }) {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("texttrack-lang") || "en"
  })

  const currentLabel = ROUTE_LABELS[location.pathname] || "TextTrack AI"

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleLanguageChange = (e) => {
    const lang = e.target.value
    setLanguage(lang)
    localStorage.setItem("texttrack-lang", lang)
    
    // Set Google Translate cookie to translate the entire UI natively
    if (lang === "en") {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${window.location.hostname}; path=/;`;
    } else {
      document.cookie = `googtrans=/en/${lang}; path=/;`;
      document.cookie = `googtrans=/en/${lang}; domain=${window.location.hostname}; path=/;`;
    }

    window.location.reload() // Force reload to apply language globally
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          {isMobile && (
            <button className="btn btn-ghost btn-icon" onClick={onMenuClick} aria-label="Toggle menu">
              <Menu size={20} />
            </button>
          )}
          <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
            <span className="topbar-breadcrumb-item">TextTrack AI</span>
            <span className="topbar-breadcrumb-separator">/</span>
            <span className="topbar-breadcrumb-current">{currentLabel}</span>
          </nav>
        </div>

        <div className="topbar-right">
          {/* Language Selector */}
          <div className="topbar-lang-group">
            <Globe size={14} style={{ color: "var(--text-tertiary)" }} />
            <select
              className="topbar-lang-select"
              value={language}
              onChange={handleLanguageChange}
              title="Select language"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {isAuthenticated && (
            <button className="topbar-search-btn" onClick={() => setIsSearchOpen(true)}>
              <Search size={15} />
              <span>Search...</span>
              <kbd className="topbar-kbd">⌘K</kbd>
            </button>
          )}

          {!isAuthenticated && (
            <div className="topbar-auth-links">
              <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </div>
          )}
        </div>
      </header>

      {isSearchOpen && <SearchModal onClose={() => setIsSearchOpen(false)} />}
    </>
  )
}

export default TopBar
