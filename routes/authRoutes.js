// routes/auth.js
const express = require("express");
const router = express.Router();
const {
  sendOtp,
  verifyOtpAndRegister,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  GetAllUsers,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

//admin
router.get("/admin/users",  GetAllUsers);
// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtpAndRegister);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

// Protected routes (require authentication)
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

module.exports = router;
