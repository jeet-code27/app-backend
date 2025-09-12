// controllers/creativeController.js
const Creative = require('../models/Creative');
const CreativeRequest = require('../models/CreativeRequest');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (same as category)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder = 'creatives') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: folder,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('Cloudinary delete result:', result);
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
};

// @desc    Admin: Upload creative for user
// @route   POST /api/creatives/upload
// @access  Private (Admin)
exports.uploadCreative = async (req, res) => {
  try {
    const { userId, title, description } = req.body;

    if (!userId || !title || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'User ID, title, and image are required.'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Upload image to Cloudinary
    const cloudinaryResponse = await uploadToCloudinary(req.file.buffer, 'creatives');
    
    const creative = new Creative({
      title,
      description,
      user: userId,
      uploadedBy: req.user.id,
      image: {
        publicId: cloudinaryResponse.public_id,
        url: cloudinaryResponse.secure_url,
        filename: cloudinaryResponse.original_filename || req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        width: cloudinaryResponse.width,
        height: cloudinaryResponse.height
      }
    });

    await creative.save();

    res.status(201).json({
      success: true,
      message: 'Creative uploaded successfully',
      data: creative
    });

  } catch (error) {
    console.error('Upload creative error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading creative.',
      error: error.message
    });
  }
};

// @desc    Admin: Get creatives by user
// @route   GET /api/creatives/admin/user/:userId
// @access  Private (Admin)
exports.getCreativesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const creatives = await Creative.find({ user: userId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Creative.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      data: creatives,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get creatives by user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching creatives.',
      error: error.message
    });
  }
};

// @desc    User: Get my creatives
// @route   GET /api/creatives/my-creatives
// @access  Private (User)
exports.getMyCreatives = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const creatives = await Creative.find({ 
      user: req.user.id, 
      isActive: true 
    })
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await Creative.countDocuments({ 
      user: req.user.id, 
      isActive: true 
    });

    res.status(200).json({
      success: true,
      data: creatives,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get my creatives error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your creatives.',
      error: error.message
    });
  }
};

// @desc    User: Download creative
// @route   GET /api/creatives/download/:id
// @access  Private (User)
exports.downloadCreative = async (req, res) => {
  try {
    const { id } = req.params;
    
    const creative = await Creative.findOne({ 
      _id: id, 
      user: req.user.id, 
      isActive: true 
    });

    if (!creative) {
      return res.status(404).json({
        success: false,
        message: 'Creative not found.'
      });
    }

    // Increment download count
    await creative.incrementDownload();

    res.status(200).json({
      success: true,
      data: {
        downloadUrl: creative.image.url,
        filename: creative.image.filename,
        title: creative.title
      }
    });

  } catch (error) {
    console.error('Download creative error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading creative.',
      error: error.message
    });
  }
};

// @desc    Admin: Delete creative
// @route   DELETE /api/creatives/:id
// @access  Private (Admin)
exports.deleteCreative = async (req, res) => {
  try {
    const { id } = req.params;
    
    const creative = await Creative.findById(id);
    if (!creative) {
      return res.status(404).json({
        success: false,
        message: 'Creative not found.'
      });
    }

    // Delete image from Cloudinary
    if (creative.image?.publicId) {
      await deleteFromCloudinary(creative.image.publicId);
    }

    await Creative.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Creative deleted successfully'
    });

  } catch (error) {
    console.error('Delete creative error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting creative.',
      error: error.message
    });
  }
};

// @desc    User: Request custom creative
// @route   POST /api/creatives/request
// @access  Private (User)
exports.requestCreative = async (req, res) => {
  try {
    const {
      title,
      description,
      businessType,
      targetAudience,
      preferredStyle,
      urgency
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required.'
      });
    }

    const creativeRequest = new CreativeRequest({
      user: req.user.id,
      title,
      description,
      businessType,
      targetAudience,
      preferredStyle,
      urgency
    });

    await creativeRequest.save();

    res.status(201).json({
      success: true,
      message: 'Creative request submitted successfully',
      data: creativeRequest
    });

  } catch (error) {
    console.error('Request creative error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting creative request.',
      error: error.message
    });
  }
};

// @desc    User: Get my requests
// @route   GET /api/creatives/my-requests
// @access  Private (User)
exports.getMyRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const requests = await CreativeRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CreativeRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your requests.',
      error: error.message
    });
  }
};

// @desc    Admin: Get all creative requests
// @route   GET /api/creatives/admin/requests
// @access  Private (Admin)
exports.getAllRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, urgency } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (urgency) filter.urgency = urgency;

    const requests = await CreativeRequest.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CreativeRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching creative requests.',
      error: error.message
    });
  }
};

// @desc    Admin: Update request status
// @route   PATCH /api/creatives/admin/requests/:id
// @access  Private (Admin)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    const request = await CreativeRequest.findByIdAndUpdate(
      id,
      { status, adminNotes },
      { new: true }
    ).populate('user', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Request status updated successfully',
      data: request
    });

  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating request status.',
      error: error.message
    });
  }
};