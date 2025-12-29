const mongoose = require('mongoose');

const zakatSchema = new mongoose.Schema({
    zakatNo: {
        type: String,
        unique: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['Pay', 'Receive'],
        default: 'Pay',
        required: [true, 'Please select transaction type']
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    branch: {
        type: String,
        required: [true, 'Please select a branch'],
        trim: true
    },
    fromBranch: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Please enter amount'],
        min: [0.01, 'Amount must be greater than 0']
    },
    remarks: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Generate zakat number before saving
zakatSchema.pre('save', async function () {
    if (!this.isNew || this.zakatNo) return;

    try {
        const count = await this.constructor.countDocuments();
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        this.zakatNo = `ZKT-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
    } catch (error) {
        throw error;
    }
});

// Indexes
zakatSchema.index({ date: -1 });
zakatSchema.index({ branch: 1 });
zakatSchema.index({ type: 1 });
zakatSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Zakat', zakatSchema);
