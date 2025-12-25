const Employee = require('../models/Employee');

// @desc    Get all employees
// @route   GET /api/v1/employees
exports.getEmployees = async (req, res) => {
    try {
        const employees = await Employee.find().populate('department').sort({ code: 1 });
        res.status(200).json({ success: true, data: employees });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single employee
// @route   GET /api/v1/employees/:id
exports.getEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id).populate('department');
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create employee
// @route   POST /api/v1/employees
exports.createEmployee = async (req, res) => {
    try {
        // Auto-generate code if not provided
        if (!req.body.code) {
            const lastEmployee = await Employee.findOne().sort({ code: -1 });
            let nextNum = 1;
            if (lastEmployee && lastEmployee.code) {
                const match = lastEmployee.code.match(/\d+/);
                if (match) {
                    nextNum = parseInt(match[0]) + 1;
                }
            }
            req.body.code = String(nextNum).padStart(4, '0');
        }

        const employee = await Employee.create(req.body);
        res.status(201).json({ success: true, data: employee });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update employee
// @route   PUT /api/v1/employees/:id
exports.updateEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete employee
// @route   DELETE /api/v1/employees/:id
exports.deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
