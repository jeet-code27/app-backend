const Combo = require("../models/Combo");
const Service = require("../models/Service");
const { validationResult } = require("express-validator");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper functions
const uploadToCloudinary = (buffer, folder = "combos") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: folder,
        transformation: [
          { width: 1200, height: 800, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};

// Controller methods
const getAllCombos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};

    if (req.query.isFeatured !== undefined) {
      filter.isFeatured = req.query.isFeatured === "true";
    }

    if (req.query.isPopular !== undefined) {
      filter.isPopular = req.query.isPopular === "true";
    }

    if (req.query.category) {
      filter.categories = req.query.category;
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const [combos, total] = await Promise.all([
      Combo.find(filter)
        .populate("services.service", "title image")
        .populate("categories", "title slug")
        .populate("templates", "title slug mainImage")
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Combo.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: combos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getFeaturedCombos = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const combos = await Combo.getFeaturedCombos(limit);

    res.json({
      success: true,
      data: combos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getPopularCombos = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const combos = await Combo.getPopularCombos(limit);

    res.json({
      success: true,
      data: combos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getCombosByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const [combos, total] = await Promise.all([
      Combo.getByCategory(categoryId, { page, limit }),
      Combo.countDocuments({ categories: categoryId, isActive: true }),
    ]);

    res.json({
      success: true,
      data: combos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getComboById = async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id)
      .populate("services.service", "title image")
      .populate("categories", "title slug description")
      .populate("templates", "title slug description mainImage");

    if (!combo) {
      return res.status(404).json({
        success: false,
        message: "Combo not found",
      });
    }

    const updatedCombo = await combo.incrementViews();

    res.json({
      success: true,
      data: updatedCombo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getComboBySlug = async (req, res) => {
  try {
    const combo = await Combo.findOne({ slug: req.params.slug, isActive: true })
      .populate("services.service", "title image ")
      .populate("categories", "title slug description")
      .populate("templates", "title slug description mainImage");

    if (!combo) {
      return res.status(404).json({
        success: false,
        message: "Combo not found",
      });
    }

    const updatedCombo = await combo.incrementViews();

    res.json({
      success: true,
      data: updatedCombo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const createCombo = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
  }

  try {
    const {
      title,
      description,
      shortDescription,
      services,
      templates = [],

      deliveryTimeValue = req.body.deliveryTime.value,
      deliveryTimeUnit = req.body.deliveryTime.unit,
      features = [],
      tags = [],
      isFeatured = false,
      isPopular = false,
      sortOrder = 0,
      alt,
    } = req.body;
   
    const {
      originalPrice,
      discountedPrice,
      currency = "INR",
    } = req.body.pricing || {};
console.log(req.body);
    const serviceIds = services.map((s) => s.service);
    const existingServices = await Service.find({
      _id: { $in: serviceIds },
      isActive: true,
    }).populate("category");

    if (existingServices.length !== serviceIds.length) {
      const missingServices = serviceIds.filter(
        (id) => !existingServices.some((s) => s._id.equals(id))
      );
      return res.status(400).json({
        success: false,
        message: "One or more services not found or inactive",
        missingServices,
      });
    }

    // Get categories from services
    const categoryIds = [
      ...new Set(existingServices.map((s) => s.category._id.toString())),
    ];

    const comboData = {
      title,
      description,
      shortDescription,
      services,
      templates,
      categories: categoryIds,
      pricing: {
        originalPrice, // or just originalPrice (ES6 shorthand)

        discountedPrice, // or discountedPrice shorthand
        currency: "INR",
      },
      deliveryTime: {
        value: deliveryTimeValue,
        unit: deliveryTimeUnit,
      },
      features,
      tags: tags.map((tag) => tag.toLowerCase()),
      isFeatured,
      isPopular,
      sortOrder,
    };
    console.log(comboData);
    // Handle image upload
    if (req.file) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(req.file.buffer);
        comboData.image = {
          publicId: cloudinaryResponse.public_id,
          url: cloudinaryResponse.secure_url,
          filename:
            cloudinaryResponse.original_filename || req.file.originalname,
          alt: alt || title,
        };
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error uploading image",
          error: error.message,
        });
      }
    }

    const combo = await Combo.create(comboData);
    const populatedCombo = await Combo.findById(combo._id)
      .populate("services.service", "title image ")
      .populate("categories", "title slug")
      .populate("templates", "title slug mainImage");

    res.status(201).json({
      success: true,
      message: "Combo created successfully",
      data: populatedCombo,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Combo with this title already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const updateCombo = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
  }

  try {
    let combo = await Combo.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({
        success: false,
        message: "Combo not found",
      });
    }

    const oldImagePublicId = combo.image?.publicId;
    let shouldDeleteOldImage = false;

    const {
      title,
      description,
      shortDescription,
      services,
      templates = [],

      deliveryTimeValue = req.body.deliveryTime.value,
      deliveryTimeUnit = req.body.deliveryTime.unit,
      features = [],
      tags = [],
      isFeatured = false,
      isPopular = false,
      sortOrder = 0,
      alt,
    } = req.body;
    console.log(req.body);
    const {
      originalPrice,
      discountedPrice,
      currency = "INR",
    } = req.body.pricing || {};

   

    // Update services and categories if services are being updated
    if (services) {
      const serviceIds = services.map((s) => s.service);
      const existingServices = await Service.find({
        _id: { $in: serviceIds },
        isActive: true,
      }).populate("category");

      if (existingServices.length !== serviceIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more services not found or inactive",
        });
      }

      combo.services = services;
      combo.categories = [
        ...new Set(existingServices.map((s) => s.category._id.toString())),
      ];
    }

    // Update other fields
    if (title) combo.title = title;
    if (description) combo.description = description;
    if (shortDescription) combo.shortDescription = shortDescription;
    if (templates) combo.templates = templates;
    if (originalPrice !== undefined)
      combo.pricing.originalPrice = originalPrice;
    if (discountedPrice !== undefined)
      combo.pricing.discountedPrice = discountedPrice;
    if (deliveryTimeValue) combo.deliveryTime.value = deliveryTimeValue;
    if (deliveryTimeUnit) combo.deliveryTime.unit = deliveryTimeUnit;
    if (features) combo.features = features;
    if (tags) combo.tags = tags.map((tag) => tag.toLowerCase());
    if (isFeatured !== undefined) combo.isFeatured = isFeatured;
    if (isPopular !== undefined) combo.isPopular = isPopular;
    if (sortOrder !== undefined) combo.sortOrder = sortOrder;
    if (alt && combo.image) combo.image.alt = alt;

    // Handle image upload
    if (req.file) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(req.file.buffer);
        combo.image = {
          publicId: cloudinaryResponse.public_id,
          url: cloudinaryResponse.secure_url,
          filename:
            cloudinaryResponse.original_filename || req.file.originalname,
          alt: alt || combo.title,
        };
        shouldDeleteOldImage = true;
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error uploading image",
          error: error.message,
        });
      }
    }

    await combo.save();

    // Delete old image if new one was uploaded
    if (shouldDeleteOldImage && oldImagePublicId) {
      try {
        await deleteFromCloudinary(oldImagePublicId);
      } catch (error) {
        console.error("Error deleting old image:", error);
      }
    }

    const populatedCombo = await Combo.findById(combo._id)
      .populate("services.service", "title image")
      .populate("categories", "title slug")
      .populate("templates", "title slug mainImage");

    res.json({
      success: true,
      message: "Combo updated successfully",
      data: populatedCombo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const toggleComboActive = async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({
        success: false,
        message: "Combo not found",
      });
    }

    const updatedCombo = await combo.toggleActive();

    res.json({
      success: true,
      message: `Combo ${
        updatedCombo.isActive ? "activated" : "deactivated"
      } successfully`,
      data: { isActive: updatedCombo.isActive },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const deleteCombo = async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({
        success: false,
        message: "Combo not found",
      });
    }

    // Delete image from Cloudinary
    if (combo.image?.publicId) {
      try {
        await deleteFromCloudinary(combo.image.publicId);
      } catch (error) {
        console.error("Error deleting image:", error);
      }
    }

    await Combo.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Combo deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllCombos,
  getFeaturedCombos,
  getPopularCombos,
  getCombosByCategory,
  getComboById,
  getComboBySlug,
  createCombo,
  updateCombo,
  toggleComboActive,
  deleteCombo,
};
