const express = require('express');
const router = express.Router();
const {
  getFacebookLoginUrl,
  handleFacebookCallback,
  getFacebookPages,
  getPageInsights,
  getPagePosts,
  disconnectFacebook,
  getFacebookStatus
} = require('../controllers/facebookController');
const { protect } = require('../middleware/auth');

/**
 * FACEBOOK INTEGRATION ROUTES
 * 
 * Flow:
 * 1. User clicks "Connect to Facebook" → GET /facebook/login-url
 * 2. User logs in to Facebook → GET /facebook/callback (handled by Facebook)
 * 3. Get user's pages → GET /facebook/pages
 * 4. Get page insights → GET /facebook/pages/:pageId/insights
 * 5. Get page posts → GET /facebook/pages/:pageId/posts
 * 6. Check connection status → GET /facebook/status
 * 7. Disconnect → DELETE /facebook/disconnect
 */

// STEP 1: Get Facebook login URL (Protected - user must be logged in)
router.get('/login-url', protect, getFacebookLoginUrl);

// STEP 2: Handle Facebook callback after user grants permissions
router.get('/callback', handleFacebookCallback);

// STEP 3: Get user's Facebook pages (Protected)
router.get('/pages', protect, getFacebookPages);

// STEP 4: Get insights for a specific page (Protected)
router.get('/pages/:pageId/insights', protect, getPageInsights);

// STEP 5: Get posts for a specific page (Protected)
router.get('/pages/:pageId/posts', protect, getPagePosts);

// STEP 6: Check Facebook connection status (Protected)
router.get('/status', protect, getFacebookStatus);

// STEP 7: Disconnect Facebook account (Protected)
router.delete('/disconnect', protect, disconnectFacebook);

module.exports = router;