// routes/creatives.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  uploadCreative,
  getCreativesByUser,
  getMyCreatives,
  downloadCreative,
  deleteCreative,
  requestCreative,
  getMyRequests,
  getAllRequests,
  updateRequestStatus
} = require('../controllers/creativeController');
const { protect, adminOnly } = require('../middleware/auth');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload only image files'), false);
    }
  }
});

// User Routes
router.get('/my-creatives', protect, getMyCreatives);
router.get('/download/:id', protect, downloadCreative);
router.post('/request', protect, requestCreative);
router.get('/my-requests', protect, getMyRequests);

// Admin Routes
router.post('/upload', protect, adminOnly, upload.single('image'), uploadCreative);
router.get('/admin/user/:userId', protect, adminOnly, getCreativesByUser);
router.delete('/:id', protect, adminOnly, deleteCreative);
router.get('/admin/requests', protect, adminOnly, getAllRequests);
router.patch('/admin/requests/:id', protect, adminOnly, updateRequestStatus);

module.exports = router;