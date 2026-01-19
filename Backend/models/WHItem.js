const mongoose = require('mongoose');

const whItemSchema = new mongoose.Schema({
    seqId: {
        type: Number,
        unique: true
    },
    itemsCode: {
        type: String,
        trim: true,
        unique: true
    },
    barcode: {
        type: String,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Please provide item name'],
        trim: true
    },
    costPrice: {
        type: Number,
        default: 0
    },
    salePrice: {
        type: Number,
        default: 0
    },
    retailPrice: {
        type: Number,
        default: 0
    },
    incentive: {
        type: Number,
        default: 0
    },

    // Relations
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHItemCompany'
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHItemCategory'
    },
    itemClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHItemClass'
    },
    subClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHItemSubClass'
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHSupplier'
    },

    // Stock Data
    stock: [{
        store: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Store'
        },
        quantity: {
            type: Number,
            default: 0
        },
        opening: {
            type: Number,
            default: 0
        }
    }],

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

module.exports = mongoose.model('WHItem', whItemSchema);
