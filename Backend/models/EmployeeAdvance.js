const mongoose = require('mongoose');

const employeeAdvanceSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    branch: {
        type: String,
        default: 'Select Branch'
    },
    code: String,
    preMonthBal: {
        type: Number,
        default: 0
    },
    currentMonthBal: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    },
    salary: {
        type: Number,
        default: 0
    },
    paid: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        default: 0
    },
    docMode: {
        type: String,
        enum: ['Cash', 'Bank'],
        default: 'Cash'
    },
    remarks: String
}, {
    timestamps: true
});

module.exports = mongoose.model('EmployeeAdvance', employeeAdvanceSchema);
