import { createContext, useContext, useState, useEffect } from "react";
import { login as loginApi, register as registerApi, logout as logoutApi, verifyToken } from "../services/auth";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await verifyToken(token);
          setUser(response.user);
        } catch (error) {
          console.error("Token verification failed:", error);
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const response = await loginApi(email, password);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem("token", response.token);
    return response;
  };

  const register = async (name, email, password) => {
    // Backend no longer returns a token on register — user must log in manually
    const response = await registerApi(name, email, password);
    return response;
  };

  const logout = async () => {
    try {
      if (token) {
        await logoutApi(token);
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
