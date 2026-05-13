import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { FileText } from "lucide-react"
import { useAuth } from "../context/AuthContext"

const Login = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const justRegistered = location.state?.registered === true

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get("error")
    if (errorParam) setError(errorParam)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!email.toLowerCase().endsWith("@gmail.com")) {
      setError("Only @gmail.com accounts are permitted to sign in.")
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate("/")
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
         setError("Incorrect email or password. Please try again.")
      } else {
         setError("Login failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError("")
    setLoading(true)
    try {
      await loginWithGoogle()
      navigate("/")
    } catch (err) {
      console.error("Google Auth Error:", err)
      setError(`Google Login failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card-new glass-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="auth-logo">
          <div className="sidebar-logo-icon" style={{ margin: "0 auto", marginBottom: 12 }}>
            <FileText size={20} />
          </div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
            TextTrack <span className="text-gradient">AI</span>
          </h2>
        </div>

        <h1>Welcome Back</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {error && <div className="auth-error-new">{error}</div>}
        {justRegistered && !error && (
          <div className="auth-info-new">Account created! Please check your email to verify, then sign in.</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form-new">
          <div>
            <label htmlFor="email">Email</label>
            <input
              type="email" id="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              required placeholder="Enter your email" disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              type="password" id="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              required placeholder="Enter your password" disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-divider-new"><span>OR</span></div>

        <button
          className="google-btn-new"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-footer-new">
          <Link to="/forgot-password">Forgot password?</Link>
          <span style={{ color: "var(--text-tertiary)" }}>•</span>
          <Link to="/register">Create account</Link>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
