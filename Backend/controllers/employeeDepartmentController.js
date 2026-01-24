const EmployeeDepartment = require('../models/EmployeeDepartment');

// @desc    Get all employee departments
// @route   GET /api/v1/employee-departments
exports.getEmployeeDepartments = async (req, res) => {
    try {
        const departments = await EmployeeDepartment.find().sort({ name: 1 });
        res.status(200).json({ success: true, data: departments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single employee department
// @route   GET /api/v1/employee-departments/:id
exports.getEmployeeDepartment = async (req, res) => {
    try {
        const department = await EmployeeDepartment.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        res.status(200).json({ success: true, data: department });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create employee department
// @route   POST /api/v1/employee-departments
exports.createEmployeeDepartment = async (req, res) => {
    try {
        const department = await EmployeeDepartment.create(req.body);
        res.status(201).json({ success: true, data: department });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update employee department
// @route   PUT /api/v1/employee-departments/:id
exports.updateEmployeeDepartment = async (req, res) => {
    try {
        const department = await EmployeeDepartment.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        res.status(200).json({ success: true, data: department });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete employee department
// @route   DELETE /api/v1/employee-departments/:id
exports.deleteEmployeeDepartment = async (req, res) => {
    try {
        const department = await EmployeeDepartment.findByIdAndDelete(req.params.id);
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
