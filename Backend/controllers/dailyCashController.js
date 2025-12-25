const DailyCash = require('../models/DailyCash');

// @desc    Get daily cash records
// @route   GET /api/v1/daily-cash
// @access  Private
exports.getDailyCash = async (req, res) => {
    try {
        const query = {};
        if (req.query.startDate && req.query.endDate) {
            const start = new Date(req.query.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(req.query.endDate);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        } else if (req.query.date) {
            const start = new Date(req.query.date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(req.query.date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        if (req.query.branch) {
            query.branch = req.query.branch;
        }

        if (req.query.mode) {
            query.mode = req.query.mode;
        }

        if (req.query.isDeduction !== undefined) {
            query.isDeduction = req.query.isDeduction === 'true';
        }

        if (req.query.hasBank === 'true') {
            query.bank = { $exists: true, $ne: null };
        }

        const records = await DailyCash.find(query).populate('department').populate('bank').sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: records.length, data: records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Create daily cash record
// @route   POST /api/v1/daily-cash
// @access  Private
exports.createDailyCash = async (req, res) => {
    try {
        const dailyCash = await DailyCash.create(req.body);
        res.status(201).json({ success: true, data: dailyCash });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update daily cash record
// @route   PUT /api/v1/daily-cash/:id
// @access  Private
exports.updateDailyCash = async (req, res) => {
    try {
        const dailyCash = await DailyCash.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!dailyCash) return res.status(404).json({ success: false, message: 'Record not found' });
        res.status(200).json({ success: true, data: dailyCash });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete daily cash record
// @route   DELETE /api/v1/daily-cash/:id
// @access  Private
exports.deleteDailyCash = async (req, res) => {
    try {
        const dailyCash = await DailyCash.findById(req.params.id);
        if (!dailyCash) return res.status(404).json({ success: false, message: 'Record not found' });
        await dailyCash.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Bulk Verify Daily Cash Records
// @route   PUT /api/v1/daily-cash/verify
// @access  Private
exports.verifyDailyCash = async (req, res) => {
    try {
        console.log('--- verifyDailyCash Hit ---');
        const { updates } = req.body; // Array of { id, isVerified }
        console.log('Updates:', JSON.stringify(updates));

        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ success: false, message: 'Invalid updates payload' });
        }

        const bulkOps = updates.map(update => ({
            updateOne: {
                filter: { _id: update.id },
                update: {
                    $set: {
                        isVerified: update.isVerified,
                        ...(update.date && { date: update.date })
                    }
                }
            }
        }));

        if (bulkOps.length > 0) {
            await DailyCash.bulkWrite(bulkOps);
        }

        res.status(200).json({ success: true, message: 'Records updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
