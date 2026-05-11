import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import TopBar from "../components/TopBar"

function DashboardLayout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.innerWidth < 768
  })
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setIsMobileSidebarOpen(false)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (isMobile) setIsMobileSidebarOpen(false)
  }, [location.pathname, isMobile])

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsMobileSidebarOpen((prev) => !prev)
    } else {
      setIsSidebarCollapsed((prev) => !prev)
    }
  }

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      {isMobile && isMobileSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar-wrapper ${
          isMobile
            ? isMobileSidebarOpen
              ? "sidebar-wrapper--mobile-open"
              : "sidebar-wrapper--mobile-closed"
            : ""
        }`}
      >
        <Sidebar
          isCollapsed={isMobile ? false : isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </div>

      {/* Main Content */}
      <div
        className="dashboard-main"
        style={{
          marginLeft: isMobile
            ? 0
            : isSidebarCollapsed
              ? "var(--sidebar-collapsed-width)"
              : "var(--sidebar-width)",
        }}
      >
        <TopBar onMenuClick={handleToggleSidebar} isMobile={isMobile} />
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
