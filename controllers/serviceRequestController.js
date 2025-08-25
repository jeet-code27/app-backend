const ServiceRequest = require("../models/ServiceRequest");
const Category = require("../models/Category");
const Service = require("../models/Service");
const Template = require("../models/Template");
const Combo = require("../models/Combo");
const {
  sendStatusUpdateEmail,
  sendCustomAdminEmail,
  sendEmail,
} = require("../utils/email");

const serviceRequestController = {
  createRequest: async (req, res) => {
    try {
      const { selectionPath, requestType, clientInfo, requirements } = req.body;

      // Validate selection path based on request type
      if (requestType === "service") {
        if (!selectionPath.selectedCategory || !selectionPath.selectedService) {
          return res.status(400).json({
            success: false,
            message:
              "Category and Service selection is required for service requests",
          });
        }
      } else if (requestType === "combo") {
        if (!selectionPath.selectedCombo) {
          return res.status(400).json({
            success: false,
            message: "Combo selection is required for combo requests",
          });
        }
      }

      // Create new service request
      const newRequest = new ServiceRequest({
        selectionPath,
        requestType,
        clientInfo,
        requirements,
      });

      await newRequest.save();

      // Populate works without importing the models explicitly
      // Mongoose uses the 'ref' property from the schema
      await newRequest.populate([
        { path: "selectionPath.selectedCategory", select: "title slug" },
        { path: "selectionPath.selectedService", select: "title slug" },
        { path: "selectionPath.selectedTemplate", select: "title slug" },
        { path: "selectionPath.selectedCombo", select: "title slug" },
      ]);

      res.status(201).json({
        success: true,
        message: "Service request submitted successfully",
        data: newRequest,
      });
    } catch (error) {
      console.error("Create Request Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit service request",
        error: error.message,
      });
    }
  },

  // READ - Get all service requests (Admin)
  getAllRequests: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        priority,
        requestType,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const query = {};

      // Apply filters
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (requestType) query.requestType = requestType;

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get total count for pagination
      const totalRequests = await ServiceRequest.countDocuments(query);

      // Fetch requests with pagination and sorting
      const requests = await ServiceRequest.find(query)
        .populate("selectionPath.selectedCategory", "title slug")
        .populate("selectionPath.selectedService", "title slug")
        .populate("selectionPath.selectedTemplate", "title slug")
        .populate("selectionPath.selectedCombo", "title slug")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Calculate pagination info
      const totalPages = Math.ceil(totalRequests / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      res.status(200).json({
        success: true,
        data: requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRequests,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Get All Requests Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch service requests",
        error: error.message,
      });
    }
  },

  // READ - Get single service request by ID
  getRequestById: async (req, res) => {
    try {
      const { id } = req.params;

      const request = await ServiceRequest.findById(id)
        .populate("selectionPath.selectedCategory", "title slug description")
        .populate(
          "selectionPath.selectedService",
          "title slug description pricing"
        )
        .populate(
          "selectionPath.selectedTemplate",
          "title slug description images"
        )
        .populate(
          "selectionPath.selectedCombo",
          "title slug description pricing"
        );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found",
        });
      }

      res.status(200).json({
        success: true,
        data: request,
      });
    } catch (error) {
      console.error("Get Request By ID Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch service request",
        error: error.message,
      });
    }
  },

  // READ - Get requests by Request ID (Public - for client tracking)
  getRequestByRequestId: async (req, res) => {
    try {
      const { requestId } = req.params;

      const request = await ServiceRequest.findOne({ requestId })
        .populate("selectionPath.selectedCategory", "title")
        .populate("selectionPath.selectedService", "title")
        .populate("selectionPath.selectedTemplate", "title")
        .populate("selectionPath.selectedCombo", "title")
        .select("-adminNotes"); // Hide admin notes from client

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found",
        });
      }

      res.status(200).json({
        success: true,
        data: request,
      });
    } catch (error) {
      console.error("Get Request By Request ID Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch service request",
        error: error.message,
      });
    }
  },

  // UPDATE - Update service request status
  updateRequestStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNote } = req.body;

      const validStatuses = [
        "submitted",
        "reviewing",
        "in-progress",
        "revision",
        "completed",
        "delivered",
        "cancelled",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status provided",
        });
      }

      const request = await ServiceRequest.findById(id);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found",
        });
      }

      const oldStatus = request.status;

      // Update status using the schema method
      await request.updateStatus(status, adminNote);

      // Send email notification if status actually changed
      if (oldStatus !== status) {
        try {
          const emailResult = await sendStatusUpdateEmail(
            request.clientInfo.email,
            request.clientInfo.fullName,
            request.requestId,
            status,
            adminNote
          );

          if (emailResult.success) {
            console.log(
              `Status update email sent to ${request.clientInfo.email}`
            );
          } else {
            console.error(
              "Failed to send status update email:",
              emailResult.error
            );
          }
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          // Don't fail the entire request if email fails
        }
      }

      res.status(200).json({
        success: true,
        message: "Request status updated successfully",
        data: request,
      });
    } catch (error) {
      console.error("Update Request Status Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update request status",
        error: error.message,
      });
    }
  },

  // UPDATE - Update request priority
  updateRequestPriority: async (req, res) => {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      const validPriorities = ["low", "medium", "high", "urgent"];

      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority provided",
        });
      }

      const request = await ServiceRequest.findByIdAndUpdate(
        id,
        { priority },
        { new: true, runValidators: true }
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Request priority updated successfully",
        data: request,
      });
    } catch (error) {
      console.error("Update Request Priority Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update request priority",
        error: error.message,
      });
    }
  },

  // UPDATE - Add admin note
  addAdminNote: async (req, res) => {
    try {
      const { id } = req.params;
      const { note, addedBy = "Admin" } = req.body;

      if (!note) {
        return res.status(400).json({
          success: false,
          message: "Note is required",
        });
      }

      const request = await ServiceRequest.findById(id);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found",
        });
      }

      request.adminNotes.push({
        note,
        addedBy,
      });

      await request.save();

      res.status(200).json({
        success: true,
        message: "Admin note added successfully",
        data: request,
      });
    } catch (error) {
      console.error("Add Admin Note Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add admin note",
        error: error.message,
      });
    }
  },

  // UPDATE - Assign request to team member
  assignRequest: async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      if (!assignedTo) {
        return res.status(400).json({
          success: false,
          message: "Assignee name is required",
        });
      }

      const request = await ServiceRequest.findByIdAndUpdate(
        id,
        { assignedTo },
        { new: true, runValidators: true }
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Request assigned successfully",
        data: request,
      });
    } catch (error) {
      console.error("Assign Request Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign request",
        error: error.message,
      });
    }
  },

  // DELETE - Delete service request (Soft delete by status)
  deleteRequest: async (req, res) => {
    try {
      const { id } = req.params;

      const request = await ServiceRequest.findByIdAndUpdate(
        id,
        { status: "cancelled" },
        { new: true }
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service request not found",
        });
      }

      // Send cancellation email notification
      try {
        const emailResult = await sendStatusUpdateEmail(
          request.clientInfo.email,
          request.clientInfo.fullName,
          request.requestId,
          "cancelled"
        );

        if (emailResult.success) {
          console.log(`Cancellation email sent to ${request.clientInfo.email}`);
        } else {
          console.error(
            "Failed to send cancellation email:",
            emailResult.error
          );
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        // Don't fail the entire request if email fails
      }

      res.status(200).json({
        success: true,
        message: "Service request cancelled successfully",
        data: request,
      });
    } catch (error) {
      console.error("Delete Request Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel service request",
        error: error.message,
      });
    }
  },

  // ANALYTICS - Get dashboard stats
  getDashboardStats: async (req, res) => {
    try {
      const stats = await Promise.all([
        
        ServiceRequest.countDocuments({ status: "submitted" }), // 0
        ServiceRequest.countDocuments({ status: "in-progress" }), // 1
        ServiceRequest.countDocuments({ status: "completed" }), // 2
        ServiceRequest.countDocuments({ priority: "urgent" }), // 3
        ServiceRequest.countDocuments({ status: "cancelled" }), // 4
        ServiceRequest.countDocuments({ status: "reviewing" }), // 5
        ServiceRequest.countDocuments({ status: "delivered" }), // 6
        ServiceRequest.countDocuments({}), // 7 (total)
      ]);

      const [
        submitted,
        inProgress,
        completed,
        urgent,
        cancelled,
        reviewing,
        delivered,
        total,
      ] = stats;

      res.status(200).json({
        success: true,
        data: {
          submitted,
          inProgress,
          completed,
          urgent,
          cancelled,
          reviewing,
          delivered,
          total,
        },
      });
    } catch (error) {
      console.error("Dashboard Stats Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard stats",
        error: error.message,
      });
    }
  },
  // UTILITY - Get requests by status (for admin filters)
  getRequestsByStatus: async (req, res) => {
    try {
      const { status } = req.params;
      const { limit = 20 } = req.query;

      const requests = await ServiceRequest.getByStatus(status).limit(
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        data: requests,
      });
    } catch (error) {
      console.error("Get Requests By Status Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch requests by status",
        error: error.message,
      });
    }
  },
  sendCustomEmailByAdmin: async (req, res) => {
    const { clientName, clientEmail, subject, message } = req.body;

    const result = await sendCustomAdminEmail(
      clientName,
      clientEmail,
      subject,
      message
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Custom admin email sent successfully",
        data: result,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send custom admin email",
      error: result.error,
    });
  },
};

module.exports = serviceRequestController;
