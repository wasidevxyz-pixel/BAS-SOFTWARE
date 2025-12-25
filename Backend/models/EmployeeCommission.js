const mongoose = require('mongoose');

const EmployeeCommissionSchema = new mongoose.Schema({
    monthYear: {
        type: String, // Format YYYY-MM
        required: true
    },
    branch: {
        type: String,
        required: true
    },
    department: {
        type: String,
        default: ''
    },
    subBranch: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['dep_item_wise', 'employee_wise', 'distribute', 'rotti_nashta', 'rotti_perks'],
        required: true
    },
    // Specific fields for Rotti Perks
    fromDate: Date,
    toDate: Date,

    // The main data array, flexible structure based on type
    data: [{
        // Common fields
        id: String, // Product ID or Employee ID (custom string ID)
        name: String, // Product Name or Employee Name

        // Dep Item Wise
        price: Number,
        qty: Number,
        total: Number,

        // Employee Wise
        commission: Number,

        // Distribute
        otherCommission: Number,
        ugCommission: Number,
        warehouseCommission: Number,
        // totalCommission handled by 'commission' or 'total'

        // Rotti & Nashta
        nashtaDays: Number,
        nashtaRate: Number,
        nashtaTotal: Number,
        rottiDays: Number,
        rottiRate: Number,
        rottiTotal: Number,

        // Rotti Perks
        basicSalary: Number,
        workedDays: Number,
        rottiTimes: Number,

        // General Total
        totalData: Number // To avoid naming conflict with total count
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound index to ensure uniqueness per type/period/branch/dept
EmployeeCommissionSchema.index({ monthYear: 1, branch: 1, department: 1, subBranch: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('EmployeeCommission', EmployeeCommissionSchema);
