import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import ProtectedRoute from "./components/ProtectedRoute"
import DashboardLayout from "./layouts/DashboardLayout"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Home from "./pages/Home"
import Upload from "./pages/Upload"
import History from "./pages/History"
import AIChat from "./pages/AIChat"

function AppRoutes() {
  return (
    <Routes>
      {/* Auth pages - no sidebar */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Dashboard pages - with sidebar */}
      <Route path="/" element={<DashboardLayout><Home /></DashboardLayout>} />
      <Route path="/upload" element={<DashboardLayout><Upload /></DashboardLayout>} />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <DashboardLayout><History /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-chat"
        element={
          <ProtectedRoute>
            <DashboardLayout><AIChat /></DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App
