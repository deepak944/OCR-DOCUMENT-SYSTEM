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

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      // For security, don't reveal if user exists
      return res.json({ message: "If an account exists with that email, a reset link has been sent." });
    }

    // Generate token
    const crypto = require("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await user.update({
      resetPasswordToken: token,
      resetPasswordExpires: expiry
    });

    const resetLink = `http://localhost:5173/reset-password?token=${token}`;

    // Send real email if configured, otherwise fallback to console
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: `TextTrack AI <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Password Reset Request - TextTrack AI",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0ea5e9;">TextTrack AI</h2>
            <p>You requested a password reset for your account.</p>
            <p>Please click the button below to set a new password. This link will expire in 1 hour.</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
            <p style="margin-top: 20px; font-size: 14px; color: #64748b;">If you did not request this, please ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">TextTrack AI - Advanced Document Intelligence</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Reset email sent to ${user.email}`);
    } else {
      // Simulation fallback
      console.log("\n--- SIMULATED EMAIL (No credentials found) ---");
      console.log(`To: ${user.email}`);
      console.log(`Link: ${resetLink}`);
      console.log("------------------------\n");
    }

    res.json({ message: "If an account exists with that email, a reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const { Op } = require("sequelize");
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user and clear token
    await user.update({
      password: hashedPassword,
      plainPassword: password, // For development visibility
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

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
      return res.redirect("http://localhost:5173/login?error=Google authentication failed");
    }

    const { generateToken } = require("../utils/jwt");
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

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
