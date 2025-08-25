const mongoose = require('mongoose');
const slugify = require('slugify');

const comboSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Combo title is required'],
    trim: true,
    maxlength: [150, 'Title cannot exceed 150 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  services: [{
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    }
  }],
  templates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  pricing: {
    originalPrice: {
      type: Number,
      
      min: 0
    },
    discountedPrice: {
      type: Number,
      
      min: 0,
     
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  deliveryTime: {
    value: {
      type: Number,
     
      min: 1
    },
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months'],
      default: 'days'
    }
  },
  features: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  image: {
    publicId: String,
    url: String,
    filename: String,
    alt: String
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
  views: {
    type: Number,
    default: 0
  },
  orders: {
    type: Number,
    default: 0
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
comboSchema.index({ categories: 1, isActive: 1 });
comboSchema.index({ isFeatured: 1 });
comboSchema.index({ isPopular: 1 });
comboSchema.index({ title: 'text', description: 'text', shortDescription: 'text', tags: 'text' });

// Pre-save middleware
comboSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isNew) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  next();
});

// Virtuals
comboSchema.virtual('discountPercentage').get(function() {
  if (this.pricing.originalPrice > 0) {
    return Math.round(((this.pricing.originalPrice - this.pricing.discountedPrice) / this.pricing.originalPrice) * 100);
  }
  return 0;
});

comboSchema.virtual('savings').get(function() {
  return this.pricing.originalPrice - this.pricing.discountedPrice;
});

// Instance methods
comboSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save({ validateBeforeSave: false });
  return this;
};

comboSchema.methods.incrementOrders = async function() {
  this.orders += 1;
  await this.save({ validateBeforeSave: false });
  return this;
};

comboSchema.methods.toggleActive = async function() {
  this.isActive = !this.isActive;
  await this.save({ validateBeforeSave: false });
  return this;
};

// Static methods
comboSchema.statics.getFeaturedCombos = function(limit = 6) {
  return this.find({ 
    isFeatured: true, 
    isActive: true 
  })
  .populate('services.service', 'title shortDescription pricing')
  .populate('categories', 'title slug')
  .populate('templates', 'title slug mainImage')
  .sort({ sortOrder: 1, createdAt: -1 })
  .limit(limit);
};

comboSchema.statics.getPopularCombos = function(limit = 6) {
  return this.find({ 
    isPopular: true, 
    isActive: true 
  })
  .populate('services.service', 'title shortDescription pricing')
  .populate('categories', 'title slug')
  .populate('templates', 'title slug mainImage')
  .sort({ orders: -1, views: -1 })
  .limit(limit);
};

comboSchema.statics.getByCategory = function(categoryId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ 
    categories: categoryId, 
    isActive: true 
  })
  .populate('services.service', 'title shortDescription pricing')
  .populate('categories', 'title slug')
  .populate('templates', 'title slug mainImage')
  .sort({ sortOrder: 1, createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

module.exports = mongoose.model('Combo', comboSchema);