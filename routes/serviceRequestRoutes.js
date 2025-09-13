const express = require("express");
const router = express.Router();
const serviceRequestController = require("../controllers/serviceRequestController");

// Validation middleware (you can create separate validation files)
const validateServiceRequest = (req, res, next) => {
  const { selectionPath, requestType, clientInfo } = req.body;

  // Basic validation
  if (!selectionPath || !requestType || !clientInfo) {
    return res.status(400).json({
      success: false,
      message: "Selection path, request type, and client info are required",
    });
  }

  // Validate client info
  if (!clientInfo.fullName || !clientInfo.email || !clientInfo.phone) {
    return res.status(400).json({
      success: false,
      message: "Client name, email, and phone are required",
    });
  }

  next();
};

// Basic auth middleware for admin routes (implement proper auth later)
const isAdmin = (req, res, next) => {
  // For now, just pass through
  // TODO: Implement proper authentication
  next();
};

// =================
// PUBLIC ROUTES
// =================

// Create new service request (Form submission)
router.post(
  "/",
  validateServiceRequest,
  serviceRequestController.createRequest
);

// Get request status by requestId (for client tracking)
router.get("/userRequest/:requestId",serviceRequestController.getUserRequestIds);
router.get("/track/:requestId", serviceRequestController.getRequestByRequestId);

// =================
// ADMIN ROUTES
// =================

// Get all service requests with filters and pagination
router.get("/admin", isAdmin, serviceRequestController.getAllRequests);

// Get dashboard statistics
router.get(
  "/admin/dashboard-stats",
  isAdmin,
  serviceRequestController.getDashboardStats
);

// Get requests by specific status
router.get(
  "/admin/status/:status",
  isAdmin,
  serviceRequestController.getRequestsByStatus
);

// Get single request by ID (detailed view)
router.get("/admin/:id", isAdmin, serviceRequestController.getRequestById);

// Update request status
router.put(
  "/admin/:id/status",
  isAdmin,
  serviceRequestController.updateRequestStatus
);

// Update request priority
router.put(
  "/admin/:id/priority",
  isAdmin,
  serviceRequestController.updateRequestPriority
);

// Add admin note to request
router.post("/admin/:id/notes", isAdmin, serviceRequestController.addAdminNote);

// Assign request to team member
router.put(
  "/admin/:id/assign",
  isAdmin,
  serviceRequestController.assignRequest
);

// Cancel/Delete request (soft delete)
router.delete("/admin/:id", isAdmin, serviceRequestController.deleteRequest);

// Send custom email to client
router.post(
  "/admin/:id/send-email",
  isAdmin,
  serviceRequestController.sendCustomEmailByAdmin
);

// =================
// ADDITIONAL UTILITY ROUTES
// =================

// Get recent requests (for admin dashboard)
router.get("/admin/recent/:limit?", isAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    const requests =
      await require("../models/ServiceRequest").getRecentRequests(limit);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent requests",
      error: error.message,
    });
  }
});

module.exports = router;
