const mongoose = require('mongoose');

const whCustomerPaymentSchema = new mongoose.Schema({
    receiptNo: {
        type: String,
        unique: true,
        trim: true
    },
    date: {
        type: Date,
        required: [true, 'Please provide payment date'],
        default: Date.now
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WHCustomer',
        required: [true, 'Please select a customer']
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store'
    },
    paymentType: {
        type: String,
        enum: ['Received', 'Pay'],
        required: [true, 'Please select payment type'],
        default: 'Received'
    },
    previousBalance: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        required: [true, 'Please provide amount'],
        min: [0, 'Amount cannot be negative']
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    balance: {
        type: Number,
        default: 0
    },
    paymentMode: {
        type: String,
        enum: ['Cash', 'Bank', 'Cheque', 'Online'],
        required: [true, 'Please select payment mode'],
        default: 'Cash'
    },
    bankName: {
        type: String
    },
    remarks: {
        type: String,
        trim: true,
        maxlength: [500, 'Remarks cannot be more than 500 characters']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
whCustomerPaymentSchema.index({ customer: 1 });
whCustomerPaymentSchema.index({ date: -1 });
whCustomerPaymentSchema.index({ paymentMode: 1 });
whCustomerPaymentSchema.index({ createdBy: 1 });

// Pre-save hook to generate receipt number
whCustomerPaymentSchema.pre('save', async function () {
    if (!this.receiptNo) {
        const count = await mongoose.model('WHCustomerPayment').countDocuments();
        const prefix = this.paymentType === 'Received' ? 'WCR' : 'WCP';
        this.receiptNo = `${prefix}-${String(count + 1).padStart(5, '0')}`;
    }

    // Calculate balance
    if (this.paymentType === 'Received') {
        this.balance = this.previousBalance - this.amount - this.discountAmount;
    } else {
        this.balance = this.previousBalance + this.amount + this.discountAmount;
    }
});


module.exports = mongoose.model('WHCustomerPayment', whCustomerPaymentSchema);
