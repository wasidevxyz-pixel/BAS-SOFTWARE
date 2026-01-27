const EmployeePenalty = require('../models/EmployeePenalty');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');

// @desc    Get all penalties
// @route   GET /api/v1/employee-penalties
exports.getPenalties = async (req, res) => {
    try {
        const { date, employee, branch } = req.query;
        let query = {};

        if (date) {
            const d = new Date(date);
            const startDate = new Date(d.getFullYear(), d.getMonth(), 1);
            const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            query.date = { $gte: startDate, $lte: endDate };
        }
        if (employee) query.employee = employee;
        if (branch) query.branch = branch;

        const penalties = await EmployeePenalty.find(query)
            .populate('employee', 'name code department designation')
            .populate('department', 'name')
            .sort({ date: -1 });

        // Check if each penalty is already linked to a saved payroll
        const penaltiesWithStatus = await Promise.all(penalties.map(async (p) => {
            const d = new Date(p.date);
            const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

            const payroll = await Payroll.findOne({
                employee: p.employee?._id,
                monthYear: monthYear
            });

            return {
                ...p._doc,
                isPosted: !!payroll
            };
        }));

        res.status(200).json({
            success: true,
            count: penaltiesWithStatus.length,
            data: penaltiesWithStatus
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

// @desc    Update penalty
// @route   PUT /api/v1/employee-penalties/:id
exports.updatePenalty = async (req, res) => {
    try {
        const penalty = await EmployeePenalty.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!penalty) {
            return res.status(404).json({ success: false, message: 'Penalty not found' });
        }

        res.status(200).json({ success: true, data: penalty });
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
