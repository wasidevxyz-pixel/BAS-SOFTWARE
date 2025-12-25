const EmployeePenalty = require('../models/EmployeePenalty');
const Employee = require('../models/Employee');

// @desc    Get all penalties
// @route   GET /api/v1/employee-penalties
exports.getPenalties = async (req, res) => {
    try {
        const { date, employee, branch } = req.query;
        let query = {};

        if (date) {
            // Match exact date or date range if needed
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            query.date = { $gte: startDate, $lt: endDate };
        }
        if (employee) query.employee = employee;
        if (branch) query.branch = branch;

        const penalties = await EmployeePenalty.find(query)
            .populate('employee', 'name code department designation')
            .populate('department', 'name')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: penalties.length,
            data: penalties
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create penalty
// @route   POST /api/v1/employee-penalties
exports.createPenalty = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;

        const penalty = await EmployeePenalty.create(req.body);

        // Optionally update Employee record if needed (e.g. cumulative penalties)

        res.status(201).json({
            success: true,
            data: penalty
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete penalty
// @route   DELETE /api/v1/employee-penalties/:id
exports.deletePenalty = async (req, res) => {
    try {
        const penalty = await EmployeePenalty.findByIdAndDelete(req.params.id);

        if (!penalty) {
            return res.status(404).json({ success: false, message: 'Penalty not found' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
