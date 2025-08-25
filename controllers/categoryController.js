const Category = require('../models/Category');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder = 'categories') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: folder,
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('Cloudinary delete result:', result);
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getAllCategories = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      isActive, 
      isMostDemanding, 
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search 
    } = req.query;

    // Build filter object
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isMostDemanding !== undefined) filter.isMostDemanding = isMostDemanding === 'true';
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const categories = await Category.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await Category.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// @desc    Get active categories only
// @route   GET /api/categories/active
// @access  Public
const getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.getActiveCategories();
    
    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active categories',
      error: error.message
    });
  }
};

// @desc    Get most demanding categories
// @route   GET /api/categories/most-demanding
// @access  Public
const getMostDemandingCategories = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const categories = await Category.getMostDemandingCategories(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching most demanding categories',
      error: error.message
    });
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id).select('-__v');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
};

// @desc    Get category by slug
// @route   GET /api/categories/slug/:slug
// @access  Public
const getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug, isActive: true }).select('-__v');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private (Admin)
const createCategory = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { title, description, isActive, isMostDemanding, sortOrder } = req.body;

    // Prepare category data
    const categoryData = {
      title,
      description,
      isActive: isActive !== undefined ? isActive === 'true' : true,
      isMostDemanding: isMostDemanding === 'true',
      sortOrder: sortOrder ? parseInt(sortOrder) : 0
    };

    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(req.file.buffer, 'categories');
        
        categoryData.image = {
          publicId: cloudinaryResponse.public_id,
          url: cloudinaryResponse.secure_url,
          filename: cloudinaryResponse.original_filename || req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          width: cloudinaryResponse.width,
          height: cloudinaryResponse.height
        };
      } catch (cloudinaryError) {
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to Cloudinary',
          error: cloudinaryError.message
        });
      }
    }

    const category = new Category(categoryData);
    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this title already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin)
const updateCategory = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { title, description, isActive, isMostDemanding, sortOrder } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Store old image public ID for deletion
    const oldImagePublicId = category.image?.publicId;

    // Update fields
    category.title = title || category.title;
    category.description = description || category.description;
    category.isActive = isActive !== undefined ? isActive === 'true' : category.isActive;
    category.isMostDemanding = isMostDemanding === 'true';
    category.sortOrder = sortOrder !== undefined ? parseInt(sortOrder) : category.sortOrder;

    // Update image if new one uploaded
    if (req.file) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(req.file.buffer, 'categories');
        
        category.image = {
          publicId: cloudinaryResponse.public_id,
          url: cloudinaryResponse.secure_url,
          filename: cloudinaryResponse.original_filename || req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          width: cloudinaryResponse.width,
          height: cloudinaryResponse.height
        };
        
        // Delete old image from Cloudinary
        if (oldImagePublicId) {
          await deleteFromCloudinary(oldImagePublicId);
        }
      } catch (cloudinaryError) {
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to Cloudinary',
          error: cloudinaryError.message
        });
      }
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this title already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
};

// @desc    Toggle category active status
// @route   PATCH /api/categories/:id/toggle-active
// @access  Private (Admin)
const toggleCategoryActive = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    await category.toggleActive();

    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling category status',
      error: error.message
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Delete image from Cloudinary
    if (category.image?.publicId) {
      await deleteFromCloudinary(category.image.publicId);
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};

// @desc    Bulk update category order
// @route   PATCH /api/categories/bulk-order
// @access  Private (Admin)
const bulkUpdateOrder = async (req, res) => {
  try {
    const { categories } = req.body; // Array of {id, sortOrder}

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Categories array is required'
      });
    }

    const bulkOps = categories.map(cat => ({
      updateOne: {
        filter: { _id: cat.id },
        update: { sortOrder: cat.sortOrder }
      }
    }));

    await Category.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Category order updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating category order',
      error: error.message
    });
  }
};

module.exports = {
  getAllCategories,
  getActiveCategories,
  getMostDemandingCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
  bulkUpdateOrder
};