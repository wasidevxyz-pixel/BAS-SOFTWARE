const mongoose = require('mongoose');

const accountCategorySchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccountGroup',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('AccountCategory', accountCategorySchema);
