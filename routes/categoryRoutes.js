const express = require("express");
const router = express.Router();
const multer = require("multer");
const { body } = require("express-validator");
const cloudinary = require("cloudinary").v2;

const {
  getAllCategories,
  getActiveCategories,
  getMostDemandingCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
  bulkUpdateOrder,
} = require("../controllers/categoryController");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer configuration for memory storage (for Cloudinary upload)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
//
// Validation rules
const categoryValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be between 2 and 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters"),

  body("sortOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer"),
];

// @route   GET /api/categories
// @desc    Get all categories with filtering, pagination, sorting
// @access  Public
router.get("/", getAllCategories);

// @route   GET /api/categories/active
// @desc    Get only active categories
// @access  Public
router.get("/active", getActiveCategories);

// @route   GET /api/categories/most-demanding
// @desc    Get most demanding categories
// @access  Public
router.get("/most-demanding", getMostDemandingCategories);

// @route   GET /api/categories/slug/:slug
// @desc    Get category by slug
// @access  Public
router.get("/slug/:slug", getCategoryBySlug);

// @route   GET /api/categories/:id
// @desc    Get single category by ID
// @access  Public
router.get("/:id", getCategoryById);

// @route   POST /api/categories
// @desc    Create new category
// @access  Private (Admin)
router.post("/", upload.single("image"), categoryValidation, createCategory);

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private (Admin)
router.put(
  "/:id",
  upload.single("image"),
  [
    body("title")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Title must be between 2 and 100 characters"),

    body("description")
      .optional()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage("Description must be between 10 and 500 characters"),

    body("sortOrder")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Sort order must be a non-negative integer"),
  ],
  updateCategory
);

// @route   PATCH /api/categories/:id/toggle-active
// @desc    Toggle category active status
// @access  Private (Admin)
router.patch("/:id/toggle-active", toggleCategoryActive);

// @route   PATCH /api/categories/bulk-order
// @desc    Bulk update category order
// @access  Private (Admin)
router.patch(
  "/bulk-order",
  [
    body("categories")
      .isArray({ min: 1 })
      .withMessage("Categories array is required"),
    body("categories.*id").notEmpty().withMessage("Category ID is required"),
    body("categories.*sortOrder")
      .isInt({ min: 0 })
      .withMessage("Sort order must be a non-negative integer"),
  ],
  bulkUpdateOrder
);

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private (Admin)
router.delete("/:id", deleteCategory);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }
  }

  if (error.message === "Only image files are allowed!") {
    return res.status(400).json({
      success: false,
      message: "Only image files are allowed!",
    });
  }

  next(error);
});

module.exports = router;
