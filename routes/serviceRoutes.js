const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body } = require('express-validator');

const {
  getAllServices,
  getServicesByCategory,
  getFeaturedServices,
  getPopularServices,
  getServiceById,
  getServiceBySlug,
  createService,
  updateService,
  toggleServiceActive,
  deleteService,
  bulkUpdateOrder
} = require('../controllers/serviceController');

// Multer configuration for memory storage (for Cloudinary upload)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Validation rules for creating service
const createServiceValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Title must be between 2 and 150 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Short description cannot exceed 200 characters'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Invalid category ID'),
  
  body('startingPrice')
    .notEmpty()
    .withMessage('Starting price is required')
    .isFloat({ min: 0 })
    .withMessage('Starting price must be a positive number'),
  
  body('currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR', 'GBP'])
    .withMessage('Invalid currency'),
  
  body('priceType')
    .optional()
    .isIn(['fixed', 'hourly', 'project', 'monthly'])
    .withMessage('Invalid price type'),
  
  body('deliveryTimeValue')
    .notEmpty()
    .withMessage('Delivery time value is required')
    .isInt({ min: 1 })
    .withMessage('Delivery time must be at least 1'),
  
  body('deliveryTimeUnit')
    .optional()
    .isIn(['days', 'weeks', 'months'])
    .withMessage('Invalid delivery time unit'),
  
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),
  
  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters')
];

// Validation rules for updating service
const updateServiceValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Title must be between 2 and 150 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Short description cannot exceed 200 characters'),
  
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),
  
  body('startingPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Starting price must be a positive number'),
  
  body('currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR', 'GBP'])
    .withMessage('Invalid currency'),
  
  body('priceType')
    .optional()
    .isIn(['fixed', 'hourly', 'project', 'monthly'])
    .withMessage('Invalid price type'),
  
  body('deliveryTimeValue')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Delivery time must be at least 1'),
  
  body('deliveryTimeUnit')
    .optional()
    .isIn(['days', 'weeks', 'months'])
    .withMessage('Invalid delivery time unit'),
  
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),
  
  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters')
];

// @route   GET /api/services
// @desc    Get all services with filtering, pagination, sorting
// @access  Public
router.get('/', getAllServices);

// @route   GET /api/services/featured
// @desc    Get featured services
// @access  Public
router.get('/featured', getFeaturedServices);

// @route   GET /api/services/popular
// @desc    Get popular services
// @access  Public
router.get('/popular', getPopularServices);

// @route   GET /api/services/category/:categoryId
// @desc    Get services by category
// @access  Public
router.get('/category/:categoryId', getServicesByCategory);

// @route   GET /api/services/slug/:slug
// @desc    Get service by slug
// @access  Public
router.get('/slug/:slug', getServiceBySlug);

// @route   GET /api/services/:id
// @desc    Get single service by ID
// @access  Public
router.get('/:id', getServiceById);

// @route   POST /api/services
// @desc    Create new service
// @access  Private (Admin)
router.post(
  '/',
  upload.single('image'),
  createServiceValidation,
  createService
);

// @route   PUT /api/services/:id
// @desc    Update service
// @access  Private (Admin)
router.put(
  '/:id',
  upload.single('image'),
  updateServiceValidation,
  updateService
);

// @route   PATCH /api/services/:id/toggle-active
// @desc    Toggle service active status
// @access  Private (Admin)
router.patch('/:id/toggle-active', toggleServiceActive);

// @route   PATCH /api/services/bulk-order
// @desc    Bulk update service order
// @access  Private (Admin)
router.patch(
  '/bulk-order',
  [
    body('services')
      .isArray({ min: 1 })
      .withMessage('Services array is required'),
    body('services.*.id')
      .notEmpty()
      .withMessage('Service ID is required'),
    body('services.*.sortOrder')
      .isInt({ min: 0 })
      .withMessage('Sort order must be a non-negative integer')
  ],
  bulkUpdateOrder
);

// @route   DELETE /api/services/:id
// @desc    Delete service
// @access  Private (Admin)
router.delete('/:id', deleteService);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed!'
    });
  }
  
  next(error);
});

module.exports = router;