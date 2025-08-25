const Service = require('../models/Service');
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
const uploadToCloudinary = (buffer, folder = 'services') => {
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

// @desc    Get all services
// @route   GET /api/services
// @access  Public
const getAllServices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category,
      isActive, 
      isFeatured,
      isPopular,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search 
    } = req.query;

    // Build filter object
    const filter = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
    if (isPopular !== undefined) filter.isPopular = isPopular === 'true';
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter['pricing.startingPrice'] = {};
      if (minPrice) filter['pricing.startingPrice'].$gte = parseFloat(minPrice);
      if (maxPrice) filter['pricing.startingPrice'].$lte = parseFloat(maxPrice);
    }
    
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const services = await Service.find(filter)
      .populate('category', 'title slug')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await Service.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: services,
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
      message: 'Error fetching services',
      error: error.message
    });
  }
};

// @desc    Get services by category
// @route   GET /api/services/category/:categoryId
// @access  Public
const getServicesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const services = await Service.getServicesByCategory(categoryId, { page, limit });
    const total = await Service.countDocuments({ category: categoryId, isActive: true });

    res.status(200).json({
      success: true,
      data: services,
      category: {
        id: category._id,
        title: category.title,
        slug: category.slug
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching services by category',
      error: error.message
    });
  }
};

// @desc    Get featured services
// @route   GET /api/services/featured
// @access  Public
const getFeaturedServices = async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const services = await Service.getFeaturedServices(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching featured services',
      error: error.message
    });
  }
};

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Public
const getPopularServices = async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const services = await Service.getPopularServices(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching popular services',
      error: error.message
    });
  }
};

// @desc    Get single service
// @route   GET /api/services/:id
// @access  Public
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id)
      .populate('category', 'title slug description')
      .select('-__v');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Increment views
    await service.incrementViews();

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching service',
      error: error.message
    });
  }
};

// @desc    Get service by slug
// @route   GET /api/services/slug/:slug
// @access  Public
const getServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const service = await Service.findOne({ slug, isActive: true })
      .populate('category', 'title slug description')
      .select('-__v');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Increment views
    await service.incrementViews();

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching service',
      error: error.message
    });
  }
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private (Admin)
const createService = async (req, res) => {
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

    const {
      title,
      description,
      shortDescription,
      category,
      startingPrice,
      currency,
      priceType,
      features,
      deliveryTimeValue,
      deliveryTimeUnit,
      isActive,
      isFeatured,
      isPopular,
      sortOrder,
      tags,
      metaTitle,
      metaDescription,
      metaKeywords
    } = req.body;

    // Verify category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    // Prepare service data
    const serviceData = {
      title,
      description,
      shortDescription,
      category,
      pricing: {
        startingPrice: parseFloat(startingPrice),
        currency: currency || 'INR',
        priceType: priceType || 'project'
      },
      features: features ? (Array.isArray(features) ? features : features.split(',').map(f => f.trim())) : [],
      deliveryTime: {
        value: parseInt(deliveryTimeValue),
        unit: deliveryTimeUnit || 'days'
      },
      isActive: isActive !== undefined ? isActive === 'true' : true,
      isFeatured: isFeatured === 'true',
      isPopular: isPopular === 'true',
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      seo: {
        metaTitle,
        metaDescription,
        metaKeywords: metaKeywords ? (Array.isArray(metaKeywords) ? metaKeywords : metaKeywords.split(',').map(k => k.trim())) : []
      }
    };

    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(req.file.buffer, 'services');
        
        serviceData.image = {
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

    const service = new Service(serviceData);
    await service.save();

    // Populate category data for response
    await service.populate('category', 'title slug');

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Service with this title already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating service',
      error: error.message
    });
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Admin)
const updateService = async (req, res) => {
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
    const service = await Service.findById(id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    const {
      title,
      description,
      shortDescription,
      category,
      startingPrice,
      currency,
      priceType,
      features,
      deliveryTimeValue,
      deliveryTimeUnit,
      isActive,
      isFeatured,
      isPopular,
      sortOrder,
      tags,
      metaTitle,
      metaDescription,
      metaKeywords
    } = req.body;

    // Verify category exists if being updated
    if (category && category !== service.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID'
        });
      }
    }

    // Store old image public ID for deletion
    const oldImagePublicId = service.image?.publicId;

    // Update fields
    service.title = title || service.title;
    service.description = description || service.description;
    service.shortDescription = shortDescription || service.shortDescription;
    service.category = category || service.category;
    
    if (startingPrice) service.pricing.startingPrice = parseFloat(startingPrice);
    if (currency) service.pricing.currency = currency;
    if (priceType) service.pricing.priceType = priceType;
    
    if (features) service.features = Array.isArray(features) ? features : features.split(',').map(f => f.trim());
    
    if (deliveryTimeValue) service.deliveryTime.value = parseInt(deliveryTimeValue);
    if (deliveryTimeUnit) service.deliveryTime.unit = deliveryTimeUnit;
    
    service.isActive = isActive !== undefined ? isActive === 'true' : service.isActive;
    service.isFeatured = isFeatured === 'true';
    service.isPopular = isPopular === 'true';
    service.sortOrder = sortOrder !== undefined ? parseInt(sortOrder) : service.sortOrder;
    
    if (tags) service.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    
    if (metaTitle) service.seo.metaTitle = metaTitle;
    if (metaDescription) service.seo.metaDescription = metaDescription;
    if (metaKeywords) service.seo.metaKeywords = Array.isArray(metaKeywords) ? metaKeywords : metaKeywords.split(',').map(k => k.trim());

    // Update image if new one uploaded
    if (req.file) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(req.file.buffer, 'services');
        
        service.image = {
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

    await service.save();
    await service.populate('category', 'title slug');

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Service with this title already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating service',
      error: error.message
    });
  }
};

// @desc    Toggle service status
// @route   PATCH /api/services/:id/toggle-active
// @access  Private (Admin)
const toggleServiceActive = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await service.toggleActive();
    await service.populate('category', 'title slug');

    res.status(200).json({
      success: true,
      message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`,
      data: service
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling service status',
      error: error.message
    });
  }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private (Admin)
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Delete image from Cloudinary
    if (service.image?.publicId) {
      await deleteFromCloudinary(service.image.publicId);
    }

    await Service.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting service',
      error: error.message
    });
  }
};

// @desc    Bulk update service order
// @route   PATCH /api/services/bulk-order
// @access  Private (Admin)
const bulkUpdateOrder = async (req, res) => {
  try {
    const { services } = req.body; // Array of {id, sortOrder}

    if (!Array.isArray(services)) {
      return res.status(400).json({
        success: false,
        message: 'Services array is required'
      });
    }

    const bulkOps = services.map(service => ({
      updateOne: {
        filter: { _id: service.id },
        update: { sortOrder: service.sortOrder }
      }
    }));

    await Service.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Service order updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating service order',
      error: error.message
    });
  }
};

module.exports = {
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
};