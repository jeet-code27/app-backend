const Template = require("../models/Template");
const Service = require("../models/Service");
const Category = require("../models/Category");
const { validationResult } = require("express-validator");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (file, folder = "templates") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "image",
          folder: folder,
          transformation: [
            { width: 1200, height: 900, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              publicId: result.public_id,
              url: result.secure_url,
              filename: result.original_filename || file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              width: result.width,
              height: result.height,
              alt: "",
            });
          }
        }
      )
      .end(file.buffer);
  });
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
};

// @desc    Get all templates
// @route   GET /api/templates
// @access  Public
const getAllTemplates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      service,
      isActive,
      isFeatured,
      search,
    } = req.query;

    // Build filter object
    const filter = {};
    if (category) filter.category = category;
    if (service) filter.service = service;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";

    if (search) {
      filter.$text = { $search: search };
    }

    const templates = await Template.find(filter)
      .populate("category", "title slug")
      .populate("service", "title slug")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Template.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: templates,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching templates",
      error: error.message,
    });
  }
};

// @desc    Get templates by category
// @route   GET /api/templates/category/:categoryId
// @access  Public
const getTemplatesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const templates = await Template.getByCategory(categoryId, { page, limit });
    const total = await Template.countDocuments({
      category: categoryId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: templates,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching templates by category",
      error: error.message,
    });
  }
};

// @desc    Get templates by service
// @route   GET /api/templates/service/:serviceId
// @access  Public
const getTemplatesByService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const templates = await Template.getByService(serviceId, { page, limit });
    const total = await Template.countDocuments({
      service: serviceId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: templates,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching templates by service",
      error: error.message,
    });
  }
};

// @desc    Get services by category (for dropdown)
// @route   GET /api/templates/services-by-category/:categoryId
// @access  Public
const getServicesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const services = await Service.find({
      category: categoryId,
      isActive: true,
    })
      .select("title _id")
      .sort({ title: 1 });

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching services",
      error: error.message,
    });
  }
};

// @desc    Get featured templates
// @route   GET /api/templates/featured
// @access  Public
const getFeaturedTemplates = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const templates = await Template.getFeaturedTemplates(parseInt(limit));

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching featured templates",
      error: error.message,
    });
  }
};

// @desc    Get single template
// @route   GET /api/templates/:id
// @access  Public
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id)
      .populate("category", "title slug")
      .populate("service", "title slug");

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Increment views
    await template.incrementViews();

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching template",
      error: error.message,
    });
  }
};

// @desc    Get template by slug
// @route   GET /api/templates/slug/:slug
// @access  Public
const getTemplateBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const template = await Template.findOne({ slug, isActive: true })
      .populate("category", "title slug")
      .populate("service", "title slug");

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Increment views
    await template.incrementViews();

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching template",
      error: error.message,
    });
  }
};

// @desc    Create new template
// @route   POST /api/templates
// @access  Private (Admin)
const createTemplate = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const {
      title,
      description,
      category,
      service,
      isActive,
      isFeatured,
      startingPrice,
    } = req.body;

    // Verify category and service exist
    const [categoryExists, serviceExists] = await Promise.all([
      Category.findById(category),
      Service.findById(service),
    ]);

    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (!serviceExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    // Verify service belongs to selected category
    if (serviceExists.category.toString() !== category) {
      return res.status(400).json({
        success: false,
        message: "Service does not belong to selected category",
      });
    }

    // Prepare template data
    const templateData = {
      title,
      description,
      category,
      service,
      isActive: isActive !== undefined ? isActive === "true" : true,
      isFeatured: isFeatured === "true",
      pricing: {
        startingPrice: startingPrice !== undefined ? Number(startingPrice) : 0,
      },
    };

    // Handle main image upload
    if (req.files?.mainImage?.[0]) {
      try {
        const mainImageResult = await uploadToCloudinary(
          req.files.mainImage[0],
          "templates/main"
        );
        templateData.mainImage = {
          publicId: mainImageResult.publicId,
          url: mainImageResult.url,
          filename: mainImageResult.filename,
          alt: title,
        };
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error uploading main image",
          error: error.message,
        });
      }
    }

    // Handle additional images upload
    if (req.files?.images) {
      try {
        const imagePromises = req.files.images.map((file) =>
          uploadToCloudinary(file, "templates/gallery")
        );
        const uploadedImages = await Promise.all(imagePromises);
        templateData.images = uploadedImages;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error uploading images",
          error: error.message,
        });
      }
    }

    const template = new Template(templateData);
    await template.save();

    // Populate references for response
    await template.populate([
      { path: "category", select: "title slug" },
      { path: "service", select: "title slug" },
    ]);

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: template,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Template with this title already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating template",
      error: error.message,
    });
  }
};

// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private (Admin)
const updateTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    const {
      title,
      description,
      category,
      service,
      startingPrice,
      isActive,
      isFeatured,
    } = req.body;

    // Verify category and service if being updated
    if (category && category !== template.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }
    }

    if (service && service !== template.service.toString()) {
      const serviceExists = await Service.findById(service);
      if (!serviceExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
      }

      // Verify service belongs to category
      const categoryToCheck = category || template.category;
      if (serviceExists.category.toString() !== categoryToCheck.toString()) {
        return res.status(400).json({
          success: false,
          message: "Service does not belong to selected category",
        });
      }
    }

    // Update fields
    template.title = title || template.title;
    template.description = description || template.description;
    template.category = category || template.category;
    template.service = service || template.service;
    template.pricing = template.pricing || {};
    template.pricing.startingPrice =
      startingPrice !== undefined
        ? Number(startingPrice)
        : template.pricing.startingPrice;
    template.isActive =
      isActive !== undefined ? isActive === "true" : template.isActive;
    template.isFeatured = isFeatured === "true";

    // Handle main image update
    if (req.files?.mainImage?.[0]) {
      try {
        // Delete old main image if exists
        if (template.mainImage?.publicId) {
          await deleteFromCloudinary(template.mainImage.publicId);
        }

        const mainImageResult = await uploadToCloudinary(
          req.files.mainImage[0],
          "templates/main"
        );
        template.mainImage = {
          publicId: mainImageResult.publicId,
          url: mainImageResult.url,
          filename: mainImageResult.filename,
          alt: template.title,
        };
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error uploading main image",
          error: error.message,
        });
      }
    }

    // Handle additional images update
    if (req.files?.images) {
      try {
        // Delete old images
        if (template.images && template.images.length > 0) {
          const deletePromises = template.images.map((img) =>
            deleteFromCloudinary(img.publicId)
          );
          await Promise.all(deletePromises);
        }

        const imagePromises = req.files.images.map((file) =>
          uploadToCloudinary(file, "templates/gallery")
        );
        const uploadedImages = await Promise.all(imagePromises);
        template.images = uploadedImages;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error uploading images",
          error: error.message,
        });
      }
    }

    await template.save();
    await template.populate([
      { path: "category", select: "title slug" },
      { path: "service", select: "title slug" },
    ]);

    res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: template,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Template with this title already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating template",
      error: error.message,
    });
  }
};

// @desc    Toggle template active status
// @route   PATCH /api/templates/:id/toggle-active
// @access  Private (Admin)
const toggleTemplateActive = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    await template.toggleActive();
    await template.populate([
      { path: "category", select: "title slug" },
      { path: "service", select: "title slug" },
    ]);

    res.status(200).json({
      success: true,
      message: `Template ${
        template.isActive ? "activated" : "deactivated"
      } successfully`,
      data: template,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling template status",
      error: error.message,
    });
  }
};

// @desc    Increment template selections
// @route   PATCH /api/templates/:id/select
// @access  Public
const selectTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    await template.incrementSelections();

    res.status(200).json({
      success: true,
      message: "Template selection recorded",
      data: {
        id: template._id,
        selections: template.selections,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error recording template selection",
      error: error.message,
    });
  }
};

// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private (Admin)
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Delete main image from Cloudinary
    if (template.mainImage?.publicId) {
      await deleteFromCloudinary(template.mainImage.publicId);
    }

    // Delete additional images from Cloudinary
    if (template.images && template.images.length > 0) {
      const deletePromises = template.images.map((img) =>
        deleteFromCloudinary(img.publicId)
      );
      await Promise.all(deletePromises);
    }

    await Template.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting template",
      error: error.message,
    });
  }
};

module.exports = {
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
  deleteTemplate,
};
