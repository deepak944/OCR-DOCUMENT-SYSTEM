const { verifyToken } = require("../utils/jwt");
const sessionStore = require("../models/Session");
const userStore = require("../models/User");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    if (sessionStore.isTokenBlacklisted(token)) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Check if user still exists
    const user = userStore.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: user.name,
    };
    req.token = token;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

module.exports = authMiddleware;
