const EmployeeAdjustment = require('../models/EmployeeAdjustment');

// @desc    Get adjustments
// @route   GET /api/v1/employee-adjustments
exports.getAdjustments = async (req, res) => {
    try {
        const { employee, date } = req.query;
        let query = {};
        if (employee) query.employee = employee;
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            query.date = { $gte: startDate, $lt: endDate };
        }

        const adjustments = await EmployeeAdjustment.find(query)
            .populate('employee', 'name code')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: adjustments.length,
            data: adjustments
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create adjustment
// @route   POST /api/v1/employee-adjustments
exports.createAdjustment = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;
        const adjustment = await EmployeeAdjustment.create(req.body);
        res.status(201).json({ success: true, data: adjustment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete adjustment
// @route   DELETE /api/v1/employee-adjustments/:id
exports.deleteAdjustment = async (req, res) => {
    try {
        const adjustment = await EmployeeAdjustment.findByIdAndDelete(req.params.id);
        if (!adjustment) {
            return res.status(404).json({ success: false, message: 'Adjustment not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
