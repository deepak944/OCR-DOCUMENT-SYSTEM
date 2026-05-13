import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FileText } from "lucide-react"
import { sendPasswordResetEmail } from "firebase/auth"
import { auth } from "../firebase"

const ForgotPassword = () => {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(""); setMessage(""); setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setMessage("Check your email for reset instructions. If an account exists with this email, a link will be sent.")
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.")
      } else {
        setError("Failed to send reset email. Please try again.")
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <motion.div className="auth-card-new glass-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
        <div className="auth-logo">
          <div className="sidebar-logo-icon" style={{ margin: "0 auto", marginBottom: 12 }}><FileText size={20} /></div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>TextTrack <span className="text-gradient">AI</span></h2>
        </div>
        <h1>Forgot Password</h1>
        <p className="auth-subtitle">Enter your email to reset your password</p>
        {error && <div className="auth-error-new">{error}</div>}
        {message && <div className="auth-info-new">{message}</div>}
        <form onSubmit={handleSubmit} className="auth-form-new">
          <div><label htmlFor="email">Email</label><input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" disabled={loading} /></div>
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
        </form>
        <div className="auth-footer-new"><Link to="/login">Back to Sign In</Link></div>
      </motion.div>
    </div>
  )
}

export default ForgotPassword
