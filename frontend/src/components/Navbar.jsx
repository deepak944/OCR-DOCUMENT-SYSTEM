import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="navbar">
      <Link to="/" state={null} style={{ textDecoration: 'none' }}>
        <h2 className="brand-logo">TextTrack <span className="brand-ai">AI</span></h2>
      </Link>
      {isAuthenticated && (
        <div className="navbar-user">
          <Link to="/" state={null} className="navbar-nav-link">Dashboard</Link>
          <Link to="/history" className="navbar-nav-link">History</Link>
          <span className="user-name">👤 {user?.name}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default Navbar;
