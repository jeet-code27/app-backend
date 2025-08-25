const express = require("express");
const router = express.Router();
const multer = require("multer");
const { body } = require("express-validator");
const comboController = require("../controllers/comboController");

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body.title) req.body.title = req.body.title.trim();
  if (req.body.description) req.body.description = req.body.description.trim();
  if (req.body.shortDescription)
    req.body.shortDescription = req.body.shortDescription.trim();
  if (req.body.tags && Array.isArray(req.body.tags)) {
    req.body.tags = req.body.tags.map((tag) => tag.trim().toLowerCase());
  }
  next();
};

// Validation rules
const comboValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 150 })
    .withMessage("Title cannot exceed 150 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Short description cannot exceed 200 characters"),

  body("services")
    .isArray({ min: 1 })
    .withMessage("At least one service required"),

  body("services.*.service")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID"),

  body("services.*.quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("pricing.originalPrice")
    .isFloat({ min: 0 })
    .withMessage("Original price must be a positive number"),

  body("pricing.discountedPrice")
  .isFloat({ min: 0 })
  .withMessage("Discounted price must be a positive number")
  .custom((value, { req }) => {
    const originalPrice = Number(req.body?.pricing?.originalPrice ?? 0)
    if (value > originalPrice) {
      throw new Error("Discounted price cannot be greater than original price")
    }
    return true
  }),

  body("deliveryTime.value")
    .isInt({ min: 1 })
    .withMessage("Delivery time must be at least 1"),

  body("deliveryTime.unit")
    .optional()
    .isIn(["days", "weeks", "months"])
    .withMessage("Invalid delivery time unit"),

  body("alt")
    .optional()
    .trim()
    .isLength({ max: 125 })
    .withMessage("Alt text cannot exceed 125 characters"),
];

// Public routes
router.get("/", comboController.getAllCombos);
router.get("/featured", comboController.getFeaturedCombos);
router.get("/popular", comboController.getPopularCombos);
router.get("/category/:categoryId", comboController.getCombosByCategory);
router.get("/slug/:slug", comboController.getComboBySlug);
router.get("/:id", comboController.getComboById);

// Admin routes
router.post(
  "/",
  upload.single("image"),
  sanitizeInput,
  comboValidation,
  comboController.createCombo
);

router.put(
  "/:id",
  upload.single("image"),
  sanitizeInput,
  comboValidation,
  comboController.updateCombo
);

router.patch("/:id/toggle-active", comboController.toggleComboActive);
router.delete("/:id", comboController.deleteCombo);

// Error handling middleware
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: "File upload error",
      error: err.message,
    });
  } else if (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
  next();
});

module.exports = router;
