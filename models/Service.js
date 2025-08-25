const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    maxlength: [150, 'Title cannot exceed 150 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  image: {
    publicId: {
      type: String,
      default: null
    },
    url: {
      type: String,
      default: null
    },
    filename: {
      type: String,
      default: null
    },
    mimetype: {
      type: String,
      default: null
    },
    size: {
      type: Number,
      default: null
    },
    width: {
      type: Number,
      default: null
    },
    height: {
      type: Number,
      default: null
    }
  },
  pricing: {
    startingPrice: {
      type: Number,
      required: [true, 'Starting price is required'],
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP']
    },
    priceType: {
      type: String,
      enum: ['fixed', 'hourly', 'project', 'monthly'],
      default: 'project'
    }
  },
  features: [{
    type: String,
    trim: true,
    maxlength: [100, 'Feature cannot exceed 100 characters']
  }],
  deliveryTime: {
    value: {
      type: Number,
      required: [true, 'Delivery time is required'],
      min: [1, 'Delivery time must be at least 1']
    },
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months'],
      default: 'days'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  slug: {
    type: String,
    // Remove unique: true from here since we're creating index below
    lowercase: true,
    trim: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  metadata: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    }
  },
  seo: {
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    metaKeywords: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug from title before saving
serviceSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/                   hyphens
  }
  next();
});

// Update category's services array when service is saved
serviceSchema.post('save', async function(doc) {
  try {
    const Category = mongoose.model('Category');
    await Category.findByIdAndUpdate(
      doc.category,
      { $addToSet: { services: doc._id } }
    );
  } catch (error) {
    console.error('Error updating category services:', error);
  }
});

// Remove service from category when service is deleted
serviceSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const Category = mongoose.model('Category');
      await Category.findByIdAndUpdate(
        doc.category,
        { $pull: { services: doc._id } }
      );
    } catch (error) {
      console.error('Error removing service from category:', error);
    }
  }
});

// Indexes for better performance
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ isActive: 1, isFeatured: 1 });
serviceSchema.index({ isActive: 1, isPopular: 1 });
serviceSchema.index({ 'pricing.startingPrice': 1 });
serviceSchema.index({ slug: 1 }, { unique: true }); // Create unique index here only
serviceSchema.index({ tags: 1 });
serviceSchema.index({ title: 'text', description: 'text', shortDescription: 'text' });

// Virtual for formatted price
serviceSchema.virtual('formattedPrice').get(function() {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  return `${symbols[this.pricing.currency] || '₹'}${this.pricing.startingPrice}`;
});

// Virtual for delivery time string
serviceSchema.virtual('deliveryTimeText').get(function() {
  return `${this.deliveryTime.value} ${this.deliveryTime.unit}`;
});

// Static method to get services by category
serviceSchema.statics.getServicesByCategory = function(categoryId, options = {}) {
  const { limit = 10, page = 1, isActive = true } = options;
  
  return this.find({ 
    category: categoryId, 
    isActive 
  })
  .populate('category', 'title slug')
  .sort({ sortOrder: 1, createdAt: -1 })
  .limit(limit * 1)
  .skip((page - 1) * limit);
};

// Static method to get featured services
serviceSchema.statics.getFeaturedServices = function(limit = 6) {
  return this.find({ 
    isActive: true, 
    isFeatured: true 
  })
  .populate('category', 'title slug')
  .sort({ sortOrder: 1, 'metadata.totalOrders': -1 })
  .limit(limit);
};

// Static method to get popular services
serviceSchema.statics.getPopularServices = function(limit = 6) {
  return this.find({ 
    isActive: true, 
    isPopular: true 
  })
  .populate('category', 'title slug')
  .sort({ 'metadata.totalOrders': -1, 'metadata.avgRating': -1 })
  .limit(limit);
};

// Instance method to toggle active status
serviceSchema.methods.toggleActive = function() {
  this.isActive = !this.isActive;
  return this.save();
};

// Instance method to update metadata
serviceSchema.methods.updateMetadata = function(updates) {
  Object.assign(this.metadata, updates);
  return this.save();
};

// Instance method to increment views
serviceSchema.methods.incrementViews = function() {
  this.metadata.views += 1;
  return this.save();
};

module.exports = mongoose.model('Service', serviceSchema);