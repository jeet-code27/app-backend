const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Category title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Category description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      publicId: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
      filename: {
        type: String,
        default: null,
      },
      mimetype: {
        type: String,
        default: null,
      },
      size: {
        type: Number,
        default: null,
      },
      width: {
        type: Number,
        default: null,
      },
      height: {
        type: Number,
        default: null,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isMostDemanding: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    metadata: {
      totalServices: {
        type: Number,
        default: 0,
      },
      totalRequests: {
        type: Number,
        default: 0,
      },
      avgRating: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create slug from title before saving
categorySchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }
  next();
});

// Index for better performance
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ isMostDemanding: 1, isActive: 1 });
categorySchema.index({ title: "text", description: "text" });

// Virtual for image URL (kept for backward compatibility, but now uses Cloudinary URL directly)
categorySchema.virtual("imageUrl").get(function () {
  if (this.image && this.image.url) {
    return this.image.url;
  }
  return null;
});

// Static method to get active categories
categorySchema.statics.getActiveCategories = function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
};

// Static method to get most demanding categories
categorySchema.statics.getMostDemandingCategories = function (limit = 5) {
  return this.find({
    isActive: true,
    isMostDemanding: true,
  })
    .sort({ sortOrder: 1, "metadata.totalRequests": -1 })
    .limit(limit);
};

// Instance method to toggle active status
categorySchema.methods.toggleActive = function () {
  this.isActive = !this.isActive;
  return this.save();
};

// Instance method to update metadata
categorySchema.methods.updateMetadata = function (updates) {
  Object.assign(this.metadata, updates);
  return this.save();
};

module.exports = mongoose.model("Category", categorySchema);
