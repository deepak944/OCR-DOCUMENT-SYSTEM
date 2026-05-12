require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { sequelize } = require("./src/models");

const authRoutes = require("./src/routes/authRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const activityRoutes = require("./src/routes/activityRoutes");
const aiRoutes = require("./src/routes/aiRoutes");
const passport = require("passport");

const app = express();
const PORT = process.env.PORT || 5000;
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "500mb";

// Increase request timeout for large file uploads (15 minutes)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || "900000", 10);

app.use(cors());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Set timeout for all requests - important for large uploads
app.use((req, res, next) => {
  // Set socket timeout
  req.socket.setTimeout(REQUEST_TIMEOUT);
  res.setTimeout(REQUEST_TIMEOUT);
  next();
});

app.use(passport.initialize());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/ai", aiRoutes);
app.use("/", documentRoutes);

app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "The uploaded OCR data is too large for this request. Please retry with a smaller document.",
    });
  }

  return next(error);
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync models (in development)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synced');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
