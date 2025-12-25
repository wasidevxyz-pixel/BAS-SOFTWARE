const mongoose = require('mongoose');

const bankTransferSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: [true, 'Transfer date is required'],
        default: Date.now
    },
    fromBank: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bank',
        required: [true, 'From bank is required']
    },
    toBank: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bank',
        required: [true, 'To bank is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    remarks: {
        type: String,
        trim: true
    },
    branch: {
        type: String,
        trim: true
    },
    fromTransaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankTransaction'
    },
    toTransaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankTransaction'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('BankTransfer', bankTransferSchema);
