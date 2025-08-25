const mongoose = require('mongoose');
const slugify = require('slugify');

const templateSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Template title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Associations
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category reference is required']
  },
  
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service reference is required']
  },
  // Pricing Information
  pricing: {
    startingPrice: {
      type: Number,
     
    },
    currency: {
      type: String,
      enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
      default: 'INR'
    }
  },

  // Template Images
  mainImage: {
    publicId: String,
    url: String,
    filename: String,
    alt: String
  },
  
  images: [{
    publicId: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    filename: String,
    mimetype: String,
    size: Number,
    width: Number,
    height: Number,
    alt: String
  }],
  
  // Status and Visibility
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  
  selections: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ service: 1, isActive: 1 });
templateSchema.index({ isFeatured: 1 });
templateSchema.index({ title: 'text', description: 'text' });

// Pre-save middleware to generate slug
templateSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isNew) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  next();
});

// Virtual for full URL
templateSchema.virtual('fullUrl').get(function() {
  return `/templates/${this.slug}`;
});

// Instance Methods
templateSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

templateSchema.methods.incrementSelections = function() {
  this.selections += 1;
  return this.save({ validateBeforeSave: false });
};

templateSchema.methods.toggleActive = function() {
  this.isActive = !this.isActive;
  return this.save();
};

// Static Methods
templateSchema.statics.getByCategory = function(categoryId, options = {}) {
  const { page = 1, limit = 12 } = options;
  
  return this.find({ 
    category: categoryId, 
    isActive: true 
  })
  .populate('category', 'title slug')
  .populate('service', 'title slug')
  .sort({ createdAt: -1 })
  .limit(limit * 1)
  .skip((page - 1) * limit);
};

templateSchema.statics.getByService = function(serviceId, options = {}) {
  const { page = 1, limit = 12 } = options;
  
  return this.find({ 
    service: serviceId, 
    isActive: true 
  })
  .populate('category', 'title slug')
  .populate('service', 'title slug')
  .sort({ createdAt: -1 })
  .limit(limit * 1)
  .skip((page - 1) * limit);
};

templateSchema.statics.getFeaturedTemplates = function(limit = 8) {
  return this.find({ 
    isFeatured: true, 
    isActive: true 
  })
  .populate('category', 'title slug')
  .populate('service', 'title slug')
  .sort({ createdAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Template', templateSchema);