const EmployeeCommission = require('../models/EmployeeCommission');

// @desc    Get commission data by filters
// @route   GET /api/v1/employee-commissions
exports.getCommissions = async (req, res) => {
    try {
        const { monthYear, branch, department, subBranch, type } = req.query;
        let query = {};

        if (monthYear) query.monthYear = monthYear;
        if (branch) query.branch = branch;
        if (department) query.department = department;
        if (subBranch) query.subBranch = subBranch;
        if (type) query.type = type;

        const commission = await EmployeeCommission.findOne(query);

        res.status(200).json({
            success: true,
            data: commission || { data: [] } // Return empty structure if not found
        });
    } catch (error) {
        console.error("Get Commission Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Save (Upsert) Commission Data
// @route   POST /api/v1/employee-commissions
exports.createCommission = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;
        const { monthYear, branch, department, subBranch, type, data, fromDate, toDate } = req.body;

        // Validation based on type
        if (!type || !branch || !monthYear) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const filter = {
            monthYear,
            branch,
            department: department || '',
            subBranch: subBranch || '',
            type
        };

        const update = {
            ...req.body,
            department: department || '',
            subBranch: subBranch || ''
        };

        const commission = await EmployeeCommission.findOneAndUpdate(
            filter,
            update,
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: commission
        });
    } catch (error) {
        console.error("Save Commission Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete commission sheet
// @route   DELETE /api/v1/employee-commissions/:id
exports.deleteCommission = async (req, res) => {
    try {
        const commission = await EmployeeCommission.findByIdAndDelete(req.params.id);

        if (!commission) {
            return res.status(404).json({ success: false, message: 'Commission not found' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
