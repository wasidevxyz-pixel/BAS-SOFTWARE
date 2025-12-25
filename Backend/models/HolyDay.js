const mongoose = require('mongoose');

const HolyDaySchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    religion: {
        type: String,
        enum: ['Islam', 'Christian', 'Hindu', 'Other'],
        required: true
    },
    description: {
        type: String,
        required: true
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

module.exports = mongoose.model('HolyDay', HolyDaySchema);
