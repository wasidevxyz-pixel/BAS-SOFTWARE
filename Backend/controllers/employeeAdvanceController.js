const EmployeeAdvance = require('../models/EmployeeAdvance');

// @desc    Get all employee advances
// @route   GET /api/v1/employee-advances
exports.getEmployeeAdvances = async (req, res) => {
    try {
        const advances = await EmployeeAdvance.find().populate('employee').sort({ date: -1 });
        res.status(200).json({ success: true, data: advances });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single employee advance
// @route   GET /api/v1/employee-advances/:id
exports.getEmployeeAdvance = async (req, res) => {
    try {
        const advance = await EmployeeAdvance.findById(req.params.id).populate('employee');
        if (!advance) {
            return res.status(404).json({ success: false, message: 'Advance not found' });
        }
        res.status(200).json({ success: true, data: advance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create employee advance
// @route   POST /api/v1/employee-advances
exports.createEmployeeAdvance = async (req, res) => {
    try {
        const advance = await EmployeeAdvance.create(req.body);
        res.status(201).json({ success: true, data: advance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update employee advance
// @route   PUT /api/v1/employee-advances/:id
exports.updateEmployeeAdvance = async (req, res) => {
    try {
        const advance = await EmployeeAdvance.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!advance) {
            return res.status(404).json({ success: false, message: 'Advance not found' });
        }
        res.status(200).json({ success: true, data: advance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete employee advance
// @route   DELETE /api/v1/employee-advances/:id
exports.deleteEmployeeAdvance = async (req, res) => {
    try {
        const advance = await EmployeeAdvance.findByIdAndDelete(req.params.id);
        if (!advance) {
            return res.status(404).json({ success: false, message: 'Advance not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
