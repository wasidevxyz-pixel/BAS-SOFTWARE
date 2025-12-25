const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const SupplierTax = require('../models/SupplierTax');

// @desc    Get all supplier tax records (with filters)
// @route   GET /api/v1/supplier-taxes
// @access  Private
exports.getSupplierTaxes = asyncHandler(async (req, res, next) => {
    let query = {};

    if (req.query.branch) {
        query.branch = req.query.branch;
    }

    if (req.query.startDate && req.query.endDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
    } else if (req.query.date) {
        // Precise date matching or range
        const d = new Date(req.query.date);
        const nextDay = new Date(d);
        nextDay.setDate(d.getDate() + 1);
        query.date = { $gte: d, $lt: nextDay };
    }

    // Basic pagination
    const data = await SupplierTax.find(query)
        .populate('branch')
        .populate({
            path: 'entries.supplier',
            populate: {
                path: 'category',
                select: 'name'
            }
        })
        .sort({ date: -1 });

    res.status(200).json({
        success: true,
        count: data.length,
        data: data
    });
});

// @desc    Create supplier tax record
// @route   POST /api/v1/supplier-taxes
// @access  Private
exports.createSupplierTax = asyncHandler(async (req, res, next) => {
    // Add user to body
    req.body.createdBy = req.user.id;

    // Check if record exists for this branch/date? 
    // If the user wants to Edit, they might need PUT.
    // Implementing simplified "Create new" for now, or Upsert.
    // Assuming one record per branch/date for simplicity if the UI is "Daily Sheet" style.

    // But wait, the UI has "Save" button.
    // I will just create a new record for now.
    const taxRecord = await SupplierTax.create(req.body);

    res.status(201).json({
        success: true,
        data: taxRecord
    });
});

// @desc    Update supplier tax record
// @route   PUT /api/v1/supplier-taxes/:id
// @access  Private
exports.updateSupplierTax = asyncHandler(async (req, res, next) => {
    let tax = await SupplierTax.findById(req.params.id);
    if (!tax) {
        return next(new ErrorResponse(`No record found with id of ${req.params.id}`, 404));
    }

    tax = await SupplierTax.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({ success: true, data: tax });
});

// @desc    Delete supplier tax record
// @route   DELETE /api/v1/supplier-taxes/:id
// @access  Private
exports.deleteSupplierTax = asyncHandler(async (req, res, next) => {
    const tax = await SupplierTax.findById(req.params.id);
    if (!tax) {
        return next(new ErrorResponse(`No record found with id of ${req.params.id}`, 404));
    }
    await tax.deleteOne();
    res.status(200).json({ success: true, data: {} });
});
// @desc    Delete single entry from supplier tax record
// @route   DELETE /api/v1/supplier-taxes/:id/entries/:entryId
// @access  Private
exports.deleteSupplierTaxEntry = asyncHandler(async (req, res, next) => {
    let tax = await SupplierTax.findById(req.params.id);
    if (!tax) {
        return next(new ErrorResponse(`No record found with id of ${req.params.id}`, 404));
    }

    // Filter out the entry
    const entryCountBefore = tax.entries.length;
    tax.entries = tax.entries.filter(entry => entry._id.toString() !== req.params.entryId);

    if (tax.entries.length === entryCountBefore) {
        return next(new ErrorResponse(`No entry found with id of ${req.params.entryId}`, 404));
    }

    // Recalculate totals
    tax.totalAmount = tax.entries.reduce((acc, r) => acc + (r.invoiceAmount || 0), 0);
    tax.totalTaxDeducted = tax.entries.reduce((acc, r) => acc + (r.taxDeducted || 0), 0);
    tax.totalAiTaxAmount = tax.entries.reduce((acc, r) => acc + (r.aiTaxAmount || 0), 0);

    // If no entries left, delete the entire sheet?
    if (tax.entries.length === 0) {
        await tax.deleteOne();
        return res.status(200).json({ success: true, data: {}, message: 'Sheet deleted as it became empty' });
    }

    await tax.save();

    res.status(200).json({ success: true, data: tax });
});
