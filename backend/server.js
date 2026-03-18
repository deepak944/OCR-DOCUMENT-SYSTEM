require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./src/routes/authRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const activityRoutes = require("./src/routes/activityRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/activities", activityRoutes);
app.use("/", documentRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
