const WHPurchase = require('../models/WHPurchase');
const WHItem = require('../models/WHItem');
const WHSupplier = require('../models/WHSupplier');
const WHStockLog = require('../models/WHStockLog');

// @desc    Create new WH Purchase
// @route   POST /api/v1/wh-purchases
// @access  Private
exports.createWHPurchase = async (req, res) => {
    try {
        const purchaseData = {
            ...req.body,
            createdBy: req.user ? req.user._id : null
        };

        // Generate Booking/Posting Number if Status is Posted
        if (purchaseData.status === 'Posted') {
            const lastPurchase = await WHPurchase.findOne({ status: 'Posted' }).sort({ postingNumber: -1 });
            const nextNumber = lastPurchase && lastPurchase.postingNumber ? lastPurchase.postingNumber + 1 : 1;
            purchaseData.postingNumber = nextNumber;
        }

        const purchase = await WHPurchase.create(purchaseData);

        // Update Stock if Status is Posted
        if (purchase.status === 'Posted') {
            for (const line of purchase.items) {
                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const purchaseQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty + purchaseQty;

                    if (whItem.stock && whItem.stock.length > 0) {
                        whItem.stock[0].quantity = newQty;
                    } else {
                        whItem.stock = [{ quantity: newQty, opening: 0 }];
                    }
                    whItem.markModified('stock');
                    await whItem.save();

                    // Create Stock Log
                    await WHStockLog.create({
                        item: whItem._id,
                        date: purchase.invoiceDate,
                        type: 'in',
                        qty: purchaseQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'purchase',
                        refId: purchase._id,
                        remarks: `Purchase #${purchase.invoiceNo || 'Draft'}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }

        res.status(201).json({
            success: true,
            data: purchase
        });
    } catch (error) {
        console.error('Error creating WH Purchase:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get all WH Purchases
// @route   GET /api/v1/wh-purchases
// @access  Private
exports.getWHPurchases = async (req, res) => {
    try {
        const purchases = await WHPurchase.find()
            .populate('supplier', 'supplierName')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: purchases.length,
            data: purchases
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get single WH Purchase
// @route   GET /api/v1/wh-purchases/:id
// @access  Private
exports.getWHPurchase = async (req, res) => {
    try {
        const purchase = await WHPurchase.findById(req.params.id)
            .populate('supplier')
            .populate({
                path: 'items.item',
                populate: [
                    { path: 'itemClass' },
                    { path: 'company' }
                ]
            });

        if (!purchase) {
            return res.status(404).json({
                success: false,
                error: 'Purchase not found'
            });
        }

        res.status(200).json({
            success: true,
            data: purchase
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Update WH Purchase
// @route   PUT /api/v1/wh-purchases/:id
// @access  Private
exports.updateWHPurchase = async (req, res) => {
    try {
        let purchase = await WHPurchase.findById(req.params.id);
        const existingStatus = purchase ? purchase.status : '';

        if (!purchase) {
            return res.status(404).json({
                success: false,
                error: 'Purchase not found'
            });
        }

        // Check if status is changing to Posted and generate number if not exists
        if (req.body.status === 'Posted' && (!purchase.postingNumber || purchase.status !== 'Posted')) {
            const lastPurchase = await WHPurchase.findOne({ status: 'Posted' }).sort({ postingNumber: -1 });
            const nextNumber = lastPurchase && lastPurchase.postingNumber ? lastPurchase.postingNumber + 1 : 1;
            req.body.postingNumber = nextNumber;
        }

        const oldItems = JSON.parse(JSON.stringify(purchase.items)); // Deep copy old items

        purchase = await WHPurchase.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // CASE 1: Transitioning to Posted OR already Posted (Modifying)
        if (purchase.status === 'Posted') {
            // If it was already Posted, reverse the OLD impact first
            if (existingStatus === 'Posted') {
                for (const line of oldItems) {
                    const whItem = await WHItem.findById(line.item);
                    if (whItem) {
                        const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                        const oldPurchaseQty = parseFloat(line.quantity) || 0;
                        const newQty = previousQty - oldPurchaseQty; // Reverse Purchase: SUBTRACT

                        if (whItem.stock && whItem.stock.length > 0) {
                            whItem.stock[0].quantity = newQty;
                        } else {
                            whItem.stock = [{ quantity: newQty, opening: 0 }];
                        }
                        whItem.markModified('stock');
                        await whItem.save();

                        await WHStockLog.create({
                            item: whItem._id,
                            date: purchase.invoiceDate,
                            type: 'out',
                            qty: oldPurchaseQty,
                            previousQty: previousQty,
                            newQty: newQty,
                            refType: 'purchase',
                            refId: purchase._id,
                            remarks: `REVERSED (Update) Purchase #${purchase.postingNumber || purchase.invoiceNo}`,
                            createdBy: req.user ? req.user._id : null
                        });
                    }
                }
            }

            // Apply NEW impact
            for (const line of purchase.items) {
                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const purchaseQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty + purchaseQty; // Add purchase

                    if (whItem.stock && whItem.stock.length > 0) {
                        whItem.stock[0].quantity = newQty;
                    } else {
                        whItem.stock = [{ quantity: newQty, opening: 0 }];
                    }
                    whItem.markModified('stock');
                    await whItem.save();

                    await WHStockLog.create({
                        item: whItem._id,
                        date: purchase.invoiceDate,
                        type: 'in',
                        qty: purchaseQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'purchase',
                        refId: purchase._id,
                        remarks: `Updated Purchase #${purchase.postingNumber || purchase.invoiceNo}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }
        // CASE 2: Transitioning from Posted to Draft
        else if (existingStatus === 'Posted') {
            for (const line of oldItems) {
                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const oldPurchaseQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty - oldPurchaseQty;

                    if (whItem.stock && whItem.stock.length > 0) {
                        whItem.stock[0].quantity = newQty;
                    } else {
                        whItem.stock = [{ quantity: newQty, opening: 0 }];
                    }
                    whItem.markModified('stock');
                    await whItem.save();

                    await WHStockLog.create({
                        item: whItem._id,
                        date: purchase.invoiceDate,
                        type: 'out',
                        qty: oldPurchaseQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'purchase',
                        refId: purchase._id,
                        remarks: `Unposted Purchase #${purchase.postingNumber || purchase.invoiceNo}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            data: purchase
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Delete WH Purchase
// @route   DELETE /api/v1/wh-purchases/:id
// @access  Private
exports.deleteWHPurchase = async (req, res) => {
    try {
        const purchase = await WHPurchase.findById(req.params.id);

        if (!purchase) {
            return res.status(404).json({
                success: false,
                error: 'Purchase not found'
            });
        }

        // Reverse stock if Posted
        if (purchase.status === 'Posted') {
            for (const line of purchase.items) {
                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const purchaseQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty - purchaseQty;

                    if (whItem.stock && whItem.stock.length > 0) {
                        whItem.stock[0].quantity = newQty;
                    } else {
                        whItem.stock = [{ quantity: newQty, opening: 0 }];
                    }
                    whItem.markModified('stock');
                    await whItem.save();

                    // Create reversal log
                    await WHStockLog.create({
                        item: whItem._id,
                        date: purchase.invoiceDate,
                        type: 'out',
                        qty: purchaseQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'purchase',
                        refId: purchase._id,
                        remarks: `DELETED: Purchase #${purchase.postingNumber || purchase.invoiceNo} (REVERSED)`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }

        await purchase.deleteOne();
        res.status(200).json({ success: true, message: 'Purchase deleted and stock reversed' });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get next invoice number
// @route   GET /api/v1/wh-purchases/next-number
exports.getNextInvoiceNumber = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year + 1, 0, 1);

        const count = await WHPurchase.countDocuments({
            createdAt: { $gte: startOfYear, $lt: endOfYear }
        });

        const nextNo = `PUR-${year}-${String(count + 1).padStart(4, '0')}`;
        res.status(200).json({ success: true, data: nextNo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
