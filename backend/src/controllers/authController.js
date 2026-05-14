const bcrypt = require("bcryptjs");
const { User, Session } = require("../models");
const { generateToken } = require("../utils/jwt");

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!email.toLowerCase().endsWith("@gmail.com")) {
      return res.status(400).json({ error: "Currently, only personal Gmail accounts (@gmail.com) are allowed." });
    }

    // Check if user exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      plainPassword: password,
    });

    // Return user without password — no token, user must log in manually
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({
      message: "User registered successfully. Please log in.",
      user: userResponse,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!email.toLowerCase().endsWith("@gmail.com")) {
      return res.status(401).json({ error: "Unauthorized: Domain not allowed." });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Create session
    await Session.create({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Return user without password
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({
      message: "Login successful",
      user: userResponse,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.token;

    // Blacklist the token
    await Session.update(
      { isBlacklisted: true },
      { where: { token } }
    );

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

const verifyTokenEndpoint = (req, res) => {
  res.json({
    valid: true,
    user: req.user,
  });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const admin = require("firebase-admin");
    const { sendPasswordResetEmail } = require("../utils/emailService");

    if (!admin.apps.length) {
      return res.status(500).json({ error: "Authentication system not ready." });
    }

    // Check if user exists in Firebase
    try {
      await admin.auth().getUserByEmail(email);
    } catch (error) {
      // User doesn't exist in Firebase, but for security we return success message
      return res.json({ message: "If an account exists with that email, a reset link has been sent." });
    }

    // Generate Firebase password reset link
    const actionCodeSettings = {
      url: 'http://localhost:5173/login',
      handleCodeInApp: false
    };
    
    const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

    // Send our PREMIUM custom email!
    await sendPasswordResetEmail(email, resetLink);

    res.json({ message: "If an account exists with that email, a reset link has been sent." });
  } catch (error) {
    console.error("[Forgot Password] Error:", error);
    res.status(500).json({ error: "Failed to process request." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and new password are required" });
    }

    const admin = require("firebase-admin");
    const { sendPasswordResetSuccessEmail } = require("../utils/emailService");

    // Update Firebase password
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(userRecord.uid, {
      password: password
    });

    // Update local DB too for consistency (though Firebase is the source of truth)
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await user.update({
        password: hashedPassword,
        plainPassword: password
      });
    }

    // Send CONGRATULATIONS email!
    await sendPasswordResetSuccessEmail(email);

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      console.error("[Google Auth] Callback failed: No user object found on request.");
      return res.redirect("http://localhost:5173/login?error=Google authentication failed");
    }

    console.log(`[Google Auth] Successfully authenticated user: ${user.email}`);

    if (!user.email.toLowerCase().endsWith("@gmail.com")) {
      console.warn(`[Google Auth] Blocking non-gmail account: ${user.email}`);
      return res.redirect("http://localhost:5173/login?error=Only @gmail.com accounts are permitted.");
    }

    const { generateToken } = require("../utils/jwt");
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    console.log(`[Google Auth] Token generated: ${token.substring(0, 10)}...`);

    const { Session } = require("../models");
    await Session.create({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.redirect(`http://localhost:5173/login?token=${token}`);
  } catch (error) {
    console.error("Google callback error:", error);
    res.redirect("http://localhost:5173/login?error=Internal server error during Google login");
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  verifyTokenEndpoint,
  forgotPassword,
  resetPassword,
  googleCallback,
};
