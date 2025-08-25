const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body } = require('express-validator');

// Import controller
const {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplatesByService,
  getServicesByCategory,
  getFeaturedTemplates,
  getTemplateById,
  getTemplateBySlug,
  createTemplate,
  updateTemplate,
  toggleTemplateActive,
  selectTemplate,
  deleteTemplate
} = require('../controllers/templateController');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload only image files'), false);
    }
  }
});

// Validation rules for template creation/update
const templateValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Template title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('category')
    .notEmpty()
    .withMessage('Category reference is required')
    .isMongoId()
    .withMessage('Invalid category ID'),
  
  body('service')
    .notEmpty()
    .withMessage('Service reference is required')
    .isMongoId()
    .withMessage('Invalid service ID'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
];

// File upload configuration for templates
const templateUpload = upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]);

// Public Routes

// @route   GET /api/templates
// @desc    Get all templates with filtering and pagination
// @access  Public
router.get('/', getAllTemplates);

// @route   GET /api/templates/featured
// @desc    Get featured templates
// @access  Public
router.get('/featured', getFeaturedTemplates);

// @route   GET /api/templates/category/:categoryId
// @desc    Get templates by category
// @access  Public
router.get('/category/:categoryId', getTemplatesByCategory);

// @route   GET /api/templates/service/:serviceId
// @desc    Get templates by service
// @access  Public
router.get('/service/:serviceId', getTemplatesByService);

// @route   GET /api/templates/services-by-category/:categoryId
// @desc    Get services by category (for dropdown)
// @access  Public
router.get('/services-by-category/:categoryId', getServicesByCategory);

// @route   GET /api/templates/slug/:slug
// @desc    Get template by slug
// @access  Public
router.get('/slug/:slug', getTemplateBySlug);

// @route   PATCH /api/templates/:id/select
// @desc    Increment template selections (when user selects template)
// @access  Public
router.patch('/:id/select', selectTemplate);

// @route   GET /api/templates/:id
// @desc    Get single template by ID
// @access  Public
router.get('/:id', getTemplateById);

// Admin Routes (Add authentication middleware as needed)

// @route   POST /api/templates
// @desc    Create new template
// @access  Private (Admin)
router.post('/', 
  templateUpload,
  templateValidation,
  createTemplate
);

// @route   PUT /api/templates/:id
// @desc    Update template
// @access  Private (Admin)
router.put('/:id',
  templateUpload,
  templateValidation,
  updateTemplate
);

// @route   PATCH /api/templates/:id/toggle-active
// @desc    Toggle template active status
// @access  Private (Admin)
router.patch('/:id/toggle-active', toggleTemplateActive);

// @route   DELETE /api/templates/:id
// @desc    Delete template
// @access  Private (Admin)
router.delete('/:id', deleteTemplate);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB per file.'
      });
    }
  }
  
  if (error.message === 'Please upload only image files') {
    return res.status(400).json({
      success: false,
      message: 'Please upload only image files (jpg, jpeg, png, gif, webp)'
    });
  }
  
  next(error);
});

module.exports = router;