const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const { User } = require("../models");
const { sendWelcomeEmail } = require("../utils/emailService");

// Path to service account key
const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin initialized with Service Account");
  } else {
    admin.initializeApp({
      projectId: "ocr-project-f7d37" // Replace with your actual ID if different
    });
    console.warn("⚠️ Firebase Admin initialized without Service Account (Some features like Password Reset will fail)");
  }
}

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);

    // Verify token using Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!decodedToken) {
      return res.status(401).json({ error: "Invalid Firebase token" });
    }

    // Sync Firebase user with local Database
    let user = await User.findOne({ where: { email: decodedToken.email } });
    
    if (!user) {
      const name = decodedToken.name || decodedToken.email.split('@')[0];
      
      // Auto-create user in Postgres if they registered via Firebase
      user = await User.create({
        name: name,
        email: decodedToken.email,
        password: "firebase_managed_password",
        isEmailVerified: decodedToken.email_verified || false,
        googleId: decodedToken.firebase.sign_in_provider === 'google.com' ? decodedToken.uid : null
      });

      // Send the beautiful Welcome Email!
      await sendWelcomeEmail(decodedToken.email, name);
    }

    // Attach user info to request
    req.user = {
      id: user.id, // Must be local DB ID for relational queries (Activity.userId)
      firebaseUid: decodedToken.uid,
      email: user.email,
      name: user.name,
    };
    req.token = token;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Authentication failed. Invalid token." });
  }
};

module.exports = authMiddleware;
