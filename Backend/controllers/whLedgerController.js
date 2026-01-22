const WHLedger = require('../models/WHLedger');
const WHCustomer = require('../models/WHCustomer');
const WHItem = require('../models/WHItem');
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

// @desc    Get WH Item Stock Position Report
// @route   GET /api/v1/wh-ledger/stock-position
// @access  Private
exports.getWHStockPosition = asyncHandler(async (req, res) => {
    const { company, category, itemClass, subClass, supplier, criteria, search } = req.query;

    let query = {};

    // Apply basic filters
    if (company) query.company = company;
    if (category) query.category = category;
    if (itemClass) query.itemClass = itemClass;
    if (subClass) query.subClass = subClass;
    if (supplier) query.supplier = supplier;

    if (search) {
        query.$or = [
            { itemsCode: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } }
        ];
    }

    // Fetch items with populated relations
    let items = await WHItem.find(query)
        .populate('company', 'name')
        .populate('category', 'name')
        .sort({ seqId: 1, name: 1 });

    // Process items to calculate total stock and apply criteria
    let data = items.map(item => {
        const currentStock = (item.stock || []).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        return {
            _id: item._id,
            seqId: item.seqId,
            itemsCode: item.itemsCode,
            name: item.name,
            company: item.company,
            category: item.category,
            costPrice: item.costPrice || 0,
            salePrice: item.salePrice || 0,
            incentive: item.incentive || 0,
            currentStock: currentStock
        };
    });

    // Apply Stock Criteria filter
    if (criteria === 'zero') {
        data = data.filter(item => item.currentStock === 0);
    } else if (criteria === 'greater') {
        data = data.filter(item => item.currentStock > 0);
    } else if (criteria === 'less') {
        data = data.filter(item => item.currentStock < 0);
    }

    res.status(200).json({
        success: true,
        count: data.length,
        data
    });
});
