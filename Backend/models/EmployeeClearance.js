const mongoose = require('mongoose');

const EmployeeClearanceSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    branch: {
        type: String,
        required: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    payrollId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payroll'
    },
    grossSalary: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },

    // Additional info from UI
    advance: { type: Number, default: 0 },
    preBalance: { type: Number, default: 0 },

    remarks: String,

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmployeeClearance', EmployeeClearanceSchema);
