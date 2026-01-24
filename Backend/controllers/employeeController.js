const Employee = require('../models/Employee');

// @desc    Get all employees
// @route   GET /api/v1/employees
exports.getEmployees = async (req, res) => {
    try {
        let query = {};

        // Filtering
        if (req.query.code) query.code = { $regex: req.query.code, $options: 'i' };
        if (req.query.name) query.name = { $regex: req.query.name, $options: 'i' };
        if (req.query.branch) query.branch = req.query.branch;
        if (req.query.department) query.department = req.query.department;
        if (req.query.designation) query.designation = req.query.designation;
        if (req.query.religion) query.religion = req.query.religion;
        if (req.query.maritalStatus) query.maritalStatus = req.query.maritalStatus;

        if (req.query.type) {
            if (req.query.type === 'commission') query.isSalesman = true;
            if (req.query.type === 'bank') query.bankCash = 'Bank';
            if (req.query.type === 'cash') query.bankCash = 'Cash';
        }

        const employees = await Employee.find(query).populate('department designation').sort({ code: 1 });
        res.status(200).json({ success: true, data: employees });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single employee
// @route   GET /api/v1/employees/:id
exports.getEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id).populate('department designation');
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
            let nextNum = 3000; // Start from 3000 as requested
            if (lastEmployee && lastEmployee.code) {
                const match = lastEmployee.code.match(/\d+/);
                if (match) {
                    const currentLastNum = parseInt(match[0]);
                    nextNum = Math.max(3000, currentLastNum + 1);
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

// @desc    Get next employee code
// @route   GET /api/v1/employees/next-code
exports.getNextCode = async (req, res) => {
    try {
        const lastEmployee = await Employee.findOne().sort({ code: -1 });
        let nextNum = 3000;
        if (lastEmployee && lastEmployee.code) {
            const match = lastEmployee.code.match(/\d+/);
            if (match) {
                const currentLastNum = parseInt(match[0]);
                nextNum = Math.max(3000, currentLastNum + 1);
            }
        }
        res.status(200).json({ success: true, data: String(nextNum).padStart(4, '0') });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
