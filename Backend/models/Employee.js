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
        ref: 'EmployeeDepartment'
    },
    designation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Designation'
    },
    address: String,
    acNo: String,
    selectBank: String, // From Image 2
    mobileNo: String,
    resPhone: String,
    dateOfBirth: Date,
    issueDate: Date,
    joiningDate: Date,
    expiryDate: Date,
    resignDate: Date,
    incrDate: Date,
    gender: {
        type: String,
        enum: ['Male', 'Female'],
        default: 'Male'
    },
    religion: {
        type: String,
        default: 'Islam'
    },
    maritalStatus: {
        type: String,
        default: 'Married'
    },
    domicile: String,

    // Salary / Fix Section
    opening: { type: Number, default: 0 },
    basicSalary: { type: Number, default: 0 },
    salaryType: { type: String, default: 'Per Month' },
    stLoss: { type: Number, default: 0 },
    fixAllowance: { type: Number, default: 0 },
    otherAllowance: { type: Number, default: 0 },
    commEmp: { type: Boolean, default: false },
    allowFood: { type: String, default: 'No Food' },
    foodAllowanceRs: { type: Number, default: 0 },
    bankCash: { type: String, default: 'Cash' },
    deduction: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },

    // Duty Section
    fDutyTime: String,
    tDutyTime: String,
    offDay: String,
    totalHrs: String,

    // Employee Access Controls
    allowOvertime: { type: Boolean, default: false },
    otst30WorkingDays: { type: Boolean, default: false },
    eobi: { type: Boolean, default: false },
    payFullSalaryThroughBank: { type: Boolean, default: false },
    electricityBill: { type: Boolean, default: false },
    thirtyWorkingDays: { type: Boolean, default: false },
    allowEmployeeAdvance: { type: Boolean, default: false },
    allowRottiPerks: { type: Boolean, default: false },
    dontAllowRottiPerks: { type: Boolean, default: false },
    allowNashtaPerks: { type: Boolean, default: false },
    dontAllowNashtaPerks: { type: Boolean, default: false },
    rottiTimes: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // Employee Bank Details
    bankDetails: {
        hbl: String,
        alf: String,
        bop: String,
        bip: String,
        bahl: String
    },

    photo: String,
}, {
    timestamps: true
});

module.exports = mongoose.model('Employee', employeeSchema);
