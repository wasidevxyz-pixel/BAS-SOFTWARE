const EmployeeCommission = require('../models/EmployeeCommission');

// @desc    Get commission data by filters
// @route   GET /api/v1/employee-commissions
exports.getCommissions = async (req, res) => {
    try {
        const { monthYear, branch, department, subBranch, type, whCategory, commissionCategory } = req.query;

        // For Dep Item Wise, we ignore the global department and unify wh/comm categories to ensure "1 Category = 1 Record"
        const finalDept = (type === 'dep_item_wise') ? '' : (department || '');
        const catName = whCategory || commissionCategory || '';

        let query = {
            monthYear,
            branch,
            type,
            department: finalDept,
            subBranch: subBranch || '',
            whCategory: whCategory || '',
            commissionCategory: commissionCategory || ''
        };

        if (type === 'dep_item_wise' && catName) {
            query = {
                monthYear,
                branch,
                type,
                $or: [
                    { whCategory: catName },
                    { commissionCategory: catName }
                ]
            };
        }

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

// @desc    Get all commissions list (summary)
// @route   GET /api/v1/employee-commissions/list
exports.getCommissionsList = async (req, res) => {
    try {
        // Fetch all, select fields except 'data' for performance
        const commissions = await EmployeeCommission.find()
            .select('-data')
            .sort({ monthYear: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: commissions.length,
            data: commissions
        });
    } catch (error) {
        console.error("List Commission Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Save (Upsert) Commission Data
// @route   POST /api/v1/employee-commissions
exports.createCommission = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;
        const { monthYear, branch, department, subBranch, type, data, fromDate, toDate, whCategory, commissionCategory } = req.body;

        // Validation based on type
        if (!type) return res.status(400).json({ success: false, message: 'Type is missing' });
        if (!branch) return res.status(400).json({ success: false, message: 'Branch is missing' });
        if (!monthYear) return res.status(400).json({ success: false, message: 'Month-Year is missing' });

        const finalDept = (type === 'dep_item_wise') ? '' : (department || '');
        const finalSubBranch = (type === 'dep_item_wise') ? '' : (subBranch || '');
        const catName = whCategory || commissionCategory || '';

        // If an ID is provided, it's an explicit update from the List
        if (req.body.id || req.body._id) {
            const updateId = req.body.id || req.body._id;
            const updated = await EmployeeCommission.findByIdAndUpdate(updateId, {
                ...req.body,
                department: finalDept,
                subBranch: finalSubBranch
            }, { new: true, runValidators: true });

            return res.status(200).json({ success: true, data: updated });
        }

        // NO ID PROVIDED: This is a new entry attempt. Check for duplicates.
        const existingFilter = {
            monthYear,
            branch,
            type,
            department: finalDept,
            subBranch: finalSubBranch,
            $or: [
                { whCategory: whCategory || '' },
                { commissionCategory: commissionCategory || '' }
            ]
        };

        // For Item Wise, we are extra strict about categories
        const existing = await EmployeeCommission.findOne(existingFilter);

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Commission for "${catName || 'this category'}" already exists for ${monthYear} at ${branch}. Please use the List button to Edit it instead of creating a new one.`
            });
        }

        // Create new record
        const commission = await EmployeeCommission.create({
            ...req.body,
            department: finalDept,
            subBranch: finalSubBranch
        });

        res.status(201).json({
            success: true,
            data: commission
        });
    } catch (error) {
        console.error("Save Commission Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get commission record by ID
// @route   GET /api/v1/employee-commissions/detail/:id
exports.getCommissionById = async (req, res) => {
    try {
        const commission = await EmployeeCommission.findById(req.params.id);
        if (!commission) {
            return res.status(404).json({ success: false, message: 'Commission record not found' });
        }
        res.status(200).json({ success: true, data: commission });
    } catch (error) {
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
