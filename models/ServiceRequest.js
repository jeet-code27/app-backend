const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
  {
    // Auto-generated unique request ID
    requestId: {
      type: String,
      unique: true, // This already creates an index, so we don't need schema.index()
      default: function () {
        return (
          "REQ-" +
          Date.now() +
          "-" +
          Math.random().toString(36).substr(2, 4).toUpperCase()
        );
      },
    },

    // User's Selection Path
    selectionPath: {
      selectedCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
      selectedService: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: function () {
          return this.requestType === "service";
        },
      },
      selectedTemplate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Template",
      },
      selectedCombo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Combo",
        required: function () {
          return this.requestType === "combo";
        },
      },
    },

    // Request Type
    requestType: {
      type: String,
      enum: ["service", "combo"],
      required: true,
    },

    // Client Information
    clientInfo: {
      fullName: {
        type: String,
        required: [true, "Full name is required"],
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"],
      },
      // user: {
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: "User",
      //   required: [true, "User is required"],
      // },
      email: {
        type: String,
        required: [true, "Email is required"],
        match: [/\S+@\S+\.\S+/, "Please enter a valid email address"],
      },
      phone: {
        type: String,
        required: [true, "Phone number is required"],
        match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number"],
      },
      businessName: {
        type: String,
        trim: true,
      },
      industry: {
        type: String,
        trim: true,
      },
    },

    // Service Requirements
    requirements: {
      businessDescription: {
        type: String,
        maxlength: [1000, "Description cannot exceed 1000 characters"],
      },

      // Color Preferences
      colors: {
        preferred: [String],
        avoid: [String],
      },

      // Content & Style
      tone: {
        type: String,
        enum: [
          "professional",
          "casual",
          "fun",
          "elegant",
          "modern",
          "traditional",
        ],
      },

      // Additional Notes
      additionalNotes: {
        type: String,
        maxlength: [2000, "Notes cannot exceed 2000 characters"],
      },

      // Custom Fields (Dynamic based on service)
      customFields: [
        {
          fieldName: String,
          fieldLabel: String,
          fieldValue: String,
          fieldType: String,
        },
      ],
    },

    // Request Status
    status: {
      type: String,
      enum: [
        "submitted",
        "reviewing",
        "in-progress",
        "revision",
        "completed",
        "delivered",
        "cancelled",
      ],
      default: "submitted",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Timeline
    timeline: {
      estimatedDelivery: Date,
      actualDelivery: Date,
    },

    // Admin Management
    adminNotes: [
      {
        note: String,
        addedBy: String,
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    assignedTo: String,

    // Pricing
    pricing: {
      quotedAmount: Number,
      finalAmount: Number,
      currency: {
        type: String,
        default: "INR",
      },
    },

    // Deliverables
    deliverables: [
      {
        fileName: String,
        fileUrl: String,
        publicId: String,
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes - REMOVED duplicate requestId index

serviceRequestSchema.index({ status: 1, createdAt: -1 });
serviceRequestSchema.index({ "clientInfo.email": 1 });
serviceRequestSchema.index({ priority: 1 });

// Instance Methods
serviceRequestSchema.methods.updateStatus = function (newStatus, adminNote) {
  this.status = newStatus;
  if (adminNote) {
    this.adminNotes.push({
      note: adminNote,
      addedBy: "Admin",
    });
  }
  return this.save();
};

// Static Methods
serviceRequestSchema.statics.getByStatus = function (status) {
  return this.find({ status })
    .populate("selectionPath.selectedCategory", "title")
    .populate("selectionPath.selectedService", "title")
    .populate("selectionPath.selectedTemplate", "title")
    .populate("selectionPath.selectedCombo", "title")
    .sort({ createdAt: -1 });
};

serviceRequestSchema.statics.getRecentRequests = function (limit = 10) {
  return this.find()
    .populate("selectionPath.selectedCategory", "title")
    .populate("selectionPath.selectedService", "title")
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
