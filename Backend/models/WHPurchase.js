const mongoose = require('mongoose');

const whPurchaseSchema = new mongoose.Schema({
    invoiceNo: {
        type: String,
        required: true,
        trim: true
    },
    invoiceDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHSupplier',
        required: true
    },
    remarks: {
        type: String,
        trim: true
    },

    // Check if user meant Group/Category for the purchase classification
    group: { // Optional classification
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    },
    whCategory: { // Optional classification
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHItemCategory'
    },
    postingNumber: {
        type: Number
    },

    // Line Items
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WHItem',
            required: true
        },
        barcode: {
            type: String,
            trim: true
        },
        batch: {
            type: String,
            trim: true
        },
        expiry: {
            type: Date
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        bonus: {
            type: Number,
            default: 0,
            min: 0
        },
        costPrice: { // P.Price
            type: Number,
            required: true,
            min: 0
        },
        salePrice: {
            type: Number,
            default: 0
        },
        discountPercent: {
            type: Number,
            default: 0
        },
        discountAmount: {
            type: Number,
            default: 0
        },
        taxPercent: {
            type: Number,
            default: 0
        },
        taxAmount: {
            type: Number,
            default: 0
        },
        totalAmount: { // Net Total for line
            type: Number,
            default: 0
        },
        retailPrice: {
            type: Number,
            default: 0
        }
    }],

    // Footer Totals
    totalQuantity: {
        type: Number,
        default: 0
    },
    subTotal: {
        type: Number,
        default: 0
    },
    totalDiscount: {
        type: Number,
        default: 0
    },
    totalTax: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number,
        default: 0
    },

    status: {
        type: String,
        enum: ['Draft', 'Posted', 'Cancelled'],
        default: 'Posted'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    history: [{
        action: String, // 'Created', 'Updated', 'Status Change'
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        changedAt: {
            type: Date,
            default: Date.now
        },
        details: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('WHPurchase', whPurchaseSchema);
