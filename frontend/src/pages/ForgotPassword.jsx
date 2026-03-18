import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/auth.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 1000);
  };

  if (submitted) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="success-icon">✓</div>
          <h1 className="auth-title">Check Your Email</h1>
          <p className="auth-subtitle">
            If an account exists for {email}, you will receive password reset instructions.
          </p>
          <Link to="/login" className="auth-button" style={{ textAlign: "center", display: "block" }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Enter your email to receive reset instructions</p>

        <div className="auth-info">
          <strong>Note:</strong> Password reset functionality will be implemented when database integration is added.
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
