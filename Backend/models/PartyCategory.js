const mongoose = require('mongoose');

const PartyCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a category name'],
        trim: true
    },
    type: { // 'customer' or 'supplier'
        type: String,
        enum: ['customer', 'supplier'],
        required: [true, 'Please specify type (customer or supplier)']
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store'
    },
    description: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PartyCategory', PartyCategorySchema);
