require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { sequelize } = require("./src/models");

const authRoutes = require("./src/routes/authRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const activityRoutes = require("./src/routes/activityRoutes");
const passport = require("passport");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/activities", activityRoutes);
app.use("/", documentRoutes);

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
