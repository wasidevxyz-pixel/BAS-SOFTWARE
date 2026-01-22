const WHLedger = require('../models/WHLedger');
const WHCustomer = require('../models/WHCustomer');
const asyncHandler = require('../middleware/async');

// @desc    Get WH Customer Ledger Report
// @route   GET /api/v1/wh-ledger/report
// @access  Private
exports.getWHLedgerReport = asyncHandler(async (req, res) => {
    const { customer, from, to } = req.query;

    if (!customer) {
        return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }

    let query = { customer };

    if (from && to) {
        query.date = {
            $gte: new Date(from),
            $lte: new Date(to)
        };
    }

    // Get transactions
    const ledgerEntries = await WHLedger.find(query).sort({ date: 1, createdAt: 1 });

    // Calculate Opening Balance (sum of all transactions before 'from' date)
    let openingBalance = 0;
    if (from) {
        const previousEntries = await WHLedger.find({
            customer,
            date: { $lt: new Date(from) }
        });
        openingBalance = previousEntries.reduce((acc, curr) => acc + (curr.debit || 0) - (curr.credit || 0), 0);
    }

    res.status(200).json({
        success: true,
        data: {
            openingBalance,
            entries: ledgerEntries
        }
    });
});

// @desc    Get WH Customer Balance Report (Summary)
// @route   GET /api/v1/wh-ledger/balances
// @access  Private
exports.getWHCustomerBalances = asyncHandler(async (req, res) => {
    const customers = await WHCustomer.find().sort({ customerName: 1 });

    // We can either use openingBalance from WHCustomer model (if we trust it's fully synced)
    // or calculate from WHLedger. For consistency with previous logic, let's use the model.

    const data = customers.map(c => ({
        _id: c._id,
        customerName: c.customerName,
        code: c.code,
        phone: c.phone || '',
        balance: c.openingBalance || 0
    }));

    res.status(200).json({
        success: true,
        count: data.length,
        data
    });
});
