// models/CreativeRequest.js
const mongoose = require('mongoose');

const creativeRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    businessType: {
        type: String,
        trim: true
    },
    targetAudience: {
        type: String,
        trim: true
    },
    preferredStyle: {
        type: String,
        trim: true
    },
    urgency: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    adminNotes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

// Index for efficient queries
creativeRequestSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('CreativeRequest', creativeRequestSchema);