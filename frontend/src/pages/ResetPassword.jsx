import { useState } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { FileText } from "lucide-react"
import { resetPassword } from "../services/api"

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (password !== confirmPassword) { setError("Passwords do not match"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    try {
      await resetPassword(token, password)
      navigate("/login", { state: { registered: false } })
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset password.")
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <motion.div className="auth-card-new glass-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
        <div className="auth-logo">
          <div className="sidebar-logo-icon" style={{ margin: "0 auto", marginBottom: 12 }}><FileText size={20} /></div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>TextTrack <span className="text-gradient">AI</span></h2>
        </div>
        <h1>Reset Password</h1>
        <p className="auth-subtitle">Enter your new password</p>
        {error && <div className="auth-error-new">{error}</div>}
        {!token && <div className="auth-error-new">Invalid or missing reset token.</div>}
        <form onSubmit={handleSubmit} className="auth-form-new">
          <div><label htmlFor="password">New Password</label><input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min 6 characters" disabled={loading || !token} /></div>
          <div><label htmlFor="confirmPassword">Confirm</label><input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm password" disabled={loading || !token} /></div>
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading || !token}>{loading ? "Resetting..." : "Reset Password"}</button>
        </form>
        <div className="auth-footer-new"><Link to="/login">Back to Sign In</Link></div>
      </motion.div>
    </div>
  )
}

export default ResetPassword
