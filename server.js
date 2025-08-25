const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

// Import routes
const categoryRoutes = require("./routes/categoryRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const templateRoutes = require("./routes/templateRoutes");
const comboRoutes = require("./routes/comboRoutes");
const authRoutes = require('./routes/authRoutes');

// Service request routes
const serviceRequestRoutes = require("./routes/serviceRequestRoutes");
// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
// app.use("/api/", limiter);

// CORS configuration
app.use(cors({}));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(bodyParser.json());
// Static files middleware for uploaded images
app.use("/uploads", express.static("uploads"));


// Database connection
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb://localhost:27017/digital_marketing_portal"
  )
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  });

// Routes
app.use("/api/categories", categoryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/combos", comboRoutes);
app.use("/api/service-requests", serviceRequestRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Digital Marketing Portal API is running!",
    timestamp: new Date().toISOString(),
  });
});

// Default route
app.get("/", (req, res) => {
  res.json({
    message: "Digital Marketing Service Request Portal API",
    version: "1.0.0",
    endpoints: {
      categories: "/api/categories",
      services: "/api/services",
      health: "/api/health",
    },
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Error:", error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

// Handle 404 routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📂 Categories API: http://localhost:${PORT}/api/categories`);
  console.log(`🛍️ Services API: http://localhost:${PORT}/api/services`);
  console.log(`🛍️ Services API: http://localhost:${PORT}/api/templates`);
  console.log(`🛍️ Services API: http://localhost:${PORT}/api/combos`);
  console.log(`🛍️ Services API: http://localhost:${PORT}/api/service-requests`);
  console.log(`🛍️ Services API: http://localhost:${PORT}/api/careers`);
});

module.exports = app;
