const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: String,
    email: String,
    address: String,
    ntn: String,
    strn: String,
    contactNo: String,
    employeeSalary: String,
    kamla: String,
    targetSale: String,
    simpleNadraCard: String,
    isActive: {
        type: Boolean,
        default: true
    },
    showOnDashboard: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Store', storeSchema);
