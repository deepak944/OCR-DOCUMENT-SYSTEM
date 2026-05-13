import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendEmailVerification, signInWithPopup, updateProfile } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const token = await currentUser.getIdToken();
        setToken(token);
        localStorage.setItem("token", token);
      } else {
        setToken(null);
        localStorage.removeItem("token");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    return await signInWithPopup(auth, googleProvider);
  };

  const register = async (name, email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Save the user's name to Firebase
    await updateProfile(userCredential.user, { displayName: name });
    await sendEmailVerification(userCredential.user);
    // We sign them out so they are forced to log in after verifying
    await signOut(auth);
    return userCredential;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    loginWithGoogle,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
