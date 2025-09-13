const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    requests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceRequest",
      },
    ],
    requestIds: [
      {
        type: String,
      },
    ],
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    // 🆕 Facebook Integration Data
    facebookData: {
      userAccessToken: {
        type: String,
        default: null,
      },
      pages: [
        {
          id: String,
          name: String,
          access_token: String,
          category: String,
          tasks: [String],
          fan_count: Number,
          followers_count: Number,
        },
      ],
      connectedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = require("crypto").randomBytes(32).toString("hex");
  this.resetPasswordToken = require("crypto")
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// 🆕 Check if user has Facebook connected
userSchema.methods.hasFacebookConnected = function () {
  return !!(this.facebookData && this.facebookData.userAccessToken);
};

// 🆕 Get Facebook page by ID
userSchema.methods.getFacebookPage = function (pageId) {
  if (!this.facebookData || !this.facebookData.pages) {
    return null;
  }
  return this.facebookData.pages.find((page) => page.id === pageId);
};

// 🆕 Remove Facebook connection
userSchema.methods.removeFacebookConnection = function () {
  this.facebookData = {
    userAccessToken: null,
    pages: [],
    connectedAt: null,
  };
  return this.save();
};

module.exports = mongoose.model("User", userSchema);
