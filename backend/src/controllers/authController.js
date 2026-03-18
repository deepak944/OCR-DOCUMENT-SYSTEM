const bcrypt = require("bcryptjs");
const userStore = require("../models/User");
const sessionStore = require("../models/Session");
const { generateToken } = require("../utils/jwt");

// Register new user
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if user already exists
    const existingUser = userStore.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = userStore.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    // Return user without password — no token, user must log in manually
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: "User registered successfully. Please log in.",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = userStore.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Track session
    sessionStore.addUserSession(user.id, token);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: "Login successful",
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

// Logout user
const logout = (req, res) => {
  try {
    const token = req.token;
    const userId = req.user.id;

    // Blacklist the token
    sessionStore.blacklistToken(token);
    sessionStore.removeUserSession(userId, token);

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

// Get current user profile
const getProfile = (req, res) => {
  try {
    const user = userStore.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// Verify token (for frontend to check if token is still valid)
const verifyTokenEndpoint = (req, res) => {
  res.json({
    valid: true,
    user: req.user,
  });
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  verifyTokenEndpoint,
};
