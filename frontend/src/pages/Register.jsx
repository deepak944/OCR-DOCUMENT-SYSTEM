import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FileText } from "lucide-react"
import { useAuth } from "../context/AuthContext"

const Register = () => {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (password !== confirmPassword) { setError("Passwords do not match"); return }
    if (!email.toLowerCase().endsWith("@gmail.com")) { setError("Only @gmail.com accounts allowed."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    try {
      await register(name, email, password)
      navigate("/login", { state: { registered: true } })
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.")
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <motion.div className="auth-card-new glass-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
        <div className="auth-logo">
          <div className="sidebar-logo-icon" style={{ margin: "0 auto", marginBottom: 12 }}><FileText size={20} /></div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>TextTrack <span className="text-gradient">AI</span></h2>
        </div>
        <h1>Create Account</h1>
        <p className="auth-subtitle">Sign up to get started</p>
        {error && <div className="auth-error-new">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form-new">
          <div><label htmlFor="name">Full Name</label><input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Enter your full name" disabled={loading} /></div>
          <div><label htmlFor="email">Email</label><input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" disabled={loading} /></div>
          <div><label htmlFor="password">Password</label><input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min 6 characters" disabled={loading} /></div>
          <div><label htmlFor="confirmPassword">Confirm Password</label><input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm password" disabled={loading} /></div>
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>{loading ? "Creating..." : "Create Account"}</button>
        </form>
        <div className="auth-footer-new"><span style={{ color: "var(--text-tertiary)" }}>Already have an account?</span> <Link to="/login">Sign in</Link></div>
      </motion.div>
    </div>
  )
}

export default Register
