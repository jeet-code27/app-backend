// models/Creative.js
const mongoose = require('mongoose');

const creativeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    image: {
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
        height: Number
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Index for efficient queries
creativeSchema.index({ user: 1, createdAt: -1 });

// Method to increment download count
creativeSchema.methods.incrementDownload = async function() {
    this.downloadCount += 1;
    return await this.save();
};

module.exports = mongoose.model('Creative', creativeSchema);
