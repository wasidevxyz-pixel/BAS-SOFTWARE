const asyncHandler = require('../middleware/async');
const Voucher = require('../models/Voucher');

// @desc    Get all vouchers
// @route   GET /api/v1/vouchers
// @access  Private
exports.getVouchers = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    let query = {};

    // Filter by type
    if (req.query.voucherType) {
        query.voucherType = req.query.voucherType;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
        query.date = {};
        if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
        if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
    }

    const total = await Voucher.countDocuments(query);
    const vouchers = await Voucher.find(query)
        .populate('createdBy', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit);

    res.status(200).json({
        success: true,
        data: vouchers,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Get single voucher
// @route   GET /api/v1/vouchers/:id
// @access  Private
exports.getVoucher = asyncHandler(async (req, res, next) => {
    const voucher = await Voucher.findById(req.params.id)
        .populate('createdBy', 'name');

    if (!voucher) {
        return res.status(404).json({
            success: false,
            message: 'Voucher not found'
        });
    }

    res.status(200).json({
        success: true,
        data: voucher
    });
});

// @desc    Create new voucher
// @route   POST /api/v1/vouchers
// @access  Private
exports.createVoucher = asyncHandler(async (req, res, next) => {
    req.body.createdBy = req.user.id;

    const voucher = await Voucher.create(req.body);

    res.status(201).json({
        success: true,
        data: voucher
    });
});

// @desc    Update voucher
// @route   PUT /api/v1/vouchers/:id
// @access  Private
exports.updateVoucher = asyncHandler(async (req, res, next) => {
    let voucher = await Voucher.findById(req.params.id);

    if (!voucher) {
        return res.status(404).json({
            success: false,
            message: 'Voucher not found'
        });
    }

    // Update fields
    if (req.body.entries) voucher.entries = req.body.entries;
    if (req.body.date) voucher.date = req.body.date;
    if (req.body.branch) voucher.branch = req.body.branch;
    if (req.body.narration) voucher.narration = req.body.narration;
    if (req.body.voucherType) voucher.voucherType = req.body.voucherType;

    await voucher.save();

    res.status(200).json({
        success: true,
        data: voucher
    });
});

// @desc    Delete voucher
// @route   DELETE /api/v1/vouchers/:id
// @access  Private
exports.deleteVoucher = asyncHandler(async (req, res, next) => {
    const voucher = await Voucher.findById(req.params.id);

    if (!voucher) {
        return res.status(404).json({
            success: false,
            message: 'Voucher not found'
        });
    }

    await voucher.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Get next voucher number
// @route   GET /api/v1/vouchers/next-number/:type
// @access  Private
exports.getNextVoucherNumber = asyncHandler(async (req, res, next) => {
    const type = req.params.type;
    const count = await Voucher.countDocuments({ voucherType: type });
    const prefix = type.toUpperCase();
    const nextNo = `${prefix}-${String(count + 1).padStart(2, '0')}`;

    res.status(200).json({
        success: true,
        data: nextNo
    });
});
