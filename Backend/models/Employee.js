const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    fatherName: String,
    cnic: String,
    branch: {
        type: String,
        default: 'Select Branch'
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    },
    designation: String,
    address: String,
    acNo: String,
    mobileNo: String,
    basicSalary: {
        type: Number,
        default: 0
    },
    joiningDate: Date,
    expiryDate: Date,
    dateOfBirth: Date,
    gender: {
        type: String,
        enum: ['Male', 'Female'],
        default: 'Male'
    },
    religion: {
        type: String,
        default: 'Islam'
    },
    // Employee Access Controls
    allowOvertime: {
        type: Boolean,
        default: false
    },
    gtst: {
        type: Boolean,
        default: false
    },
    eobi: {
        type: Boolean,
        default: false
    },
    payProficiency: {
        type: Boolean,
        default: false
    },
    discountBill: {
        type: Boolean,
        default: false
    },
    threeWorkingDays: {
        type: Boolean,
        default: false
    },
    allowEmployeeAdvance: {
        type: Boolean,
        default: false
    },
    allowStockPerks: {
        type: Boolean,
        default: false
    },
    deductAllowBillPerks: {
        type: Boolean,
        default: false
    },
    allowTicketPerks: {
        type: Boolean,
        default: false
    },
    heartAllowTicketPerks: {
        type: Boolean,
        default: false
    },
    // Employee Bank Details
    bankDetails: {
        hbl: String,
        alf: String,
        bop: String,
        jsf: String,
        bafl: String
    },
    // Fix Allowance
    fixAllowance: {
        stLoan: { type: Number, default: 0 },
        allowance: { type: Number, default: 0 }
    },
    otherAllowance: String,
    comingEmp: {
        type: Boolean,
        default: false
    },
    allowFood: String,
    bankCash: String,
    definition: String,
    securityDeposit: {
        type: Number,
        default: 0
    },
    photo: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Employee', employeeSchema);
