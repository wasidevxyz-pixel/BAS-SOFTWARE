const mongoose = require('mongoose');

const EmployeeDepartmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a department name'],
        unique: true,
        trim: true
    },
    branch: {
        type: String,
        default: 'F-6'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('EmployeeDepartment', EmployeeDepartmentSchema);
