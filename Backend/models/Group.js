const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a group name'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    rights: {
        // We will store rights as an object where keys are category/module names
        // and values are boolean or an array of specific actions.
        // Simplifying to a flat object of permissions for now.
        type: Map,
        of: Boolean,
        default: {}
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Group', groupSchema);
