const WHPurchaseReturn = require('../models/WHPurchaseReturn');
const WHItem = require('../models/WHItem');
const WHStockLog = require('../models/WHStockLog');

// Create Purchase Return
exports.createWHPurchaseReturn = async (req, res) => {
    try {
        const returnData = req.body;
        returnData.createdBy = req.user._id;

        // Generate posting number if status is Posted
        if (returnData.status === 'Posted') {
            const lastPosted = await WHPurchaseReturn.findOne({ status: 'Posted' })
                .sort({ postingNumber: -1 })
                .select('postingNumber');
            returnData.postingNumber = lastPosted ? lastPosted.postingNumber + 1 : 1;
        }

        const purchaseReturn = await WHPurchaseReturn.create(returnData);

        // Update stock if Posted (REDUCE stock for returns)
        if (returnData.status === 'Posted') {
            for (const item of returnData.items) {
                const whItem = await WHItem.findById(item.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const returnQty = parseFloat(item.quantity) || 0;
                    const newQty = previousQty - returnQty;

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
                        type: 'out',
                        qty: returnQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'purchase_return',
                        refId: purchaseReturn._id,
                        remarks: `Purchase Return #${purchaseReturn.postingNumber || 'Draft'}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }

        const populated = await WHPurchaseReturn.findById(purchaseReturn._id)
            .populate('supplier', 'supplierName')
            .populate('createdBy', 'name')
            .populate('items.item', 'name itemsCode');

        res.status(201).json({
            success: true,
            message: 'Purchase return created successfully',
            data: populated
        });
    } catch (error) {
        console.error('Error creating purchase return:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get all Purchase Returns
exports.getWHPurchaseReturns = async (req, res) => {
    try {
        const returns = await WHPurchaseReturn.find()
            .populate('supplier', 'supplierName')
            .populate('createdBy', 'name')
            .populate('originalPurchase', 'invoiceNo')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: returns
        });
    } catch (error) {
        console.error('Error fetching purchase returns:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get single Purchase Return
exports.getWHPurchaseReturnById = async (req, res) => {
    try {
        const purchaseReturn = await WHPurchaseReturn.findById(req.params.id)
            .populate('supplier', 'supplierName')
            .populate('createdBy', 'name')
            .populate('originalPurchase', 'invoiceNo')
            .populate('items.item', 'name itemsCode barcode');

        if (!purchaseReturn) {
            return res.status(404).json({
                success: false,
                error: 'Purchase return not found'
            });
        }

        res.json({
            success: true,
            data: purchaseReturn
        });
    } catch (error) {
        console.error('Error fetching purchase return:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Update Purchase Return
exports.updateWHPurchaseReturn = async (req, res) => {
    try {
        const returnData = req.body;
        const existingReturn = await WHPurchaseReturn.findById(req.params.id);

        if (!existingReturn) {
            return res.status(404).json({
                success: false,
                error: 'Purchase return not found'
            });
        }

        // Generate posting number if changing to Posted
        if (returnData.status === 'Posted' && existingReturn.status !== 'Posted') {
            const lastPosted = await WHPurchaseReturn.findOne({ status: 'Posted' })
                .sort({ postingNumber: -1 })
                .select('postingNumber');
            returnData.postingNumber = lastPosted ? lastPosted.postingNumber + 1 : 1;

            // Update stock (REDUCE)
            for (const item of returnData.items) {
                const whItem = await WHItem.findById(item.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const returnQty = parseFloat(item.quantity) || 0;
                    const newQty = previousQty - returnQty;

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
                        type: 'out',
                        qty: returnQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'purchase_return',
                        refId: existingReturn._id,
                        remarks: `Purchase Return #${returnData.postingNumber}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }

        const updated = await WHPurchaseReturn.findByIdAndUpdate(
            req.params.id,
            returnData,
            { new: true, runValidators: true }
        )
            .populate('supplier', 'supplierName')
            .populate('createdBy', 'name')
            .populate('items.item', 'name itemsCode');

        res.json({
            success: true,
            message: 'Purchase return updated successfully',
            data: updated
        });
    } catch (error) {
        console.error('Error updating purchase return:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Delete Purchase Return
exports.deleteWHPurchaseReturn = async (req, res) => {
    try {
        const purchaseReturn = await WHPurchaseReturn.findById(req.params.id);

        if (!purchaseReturn) {
            return res.status(404).json({
                success: false,
                error: 'Purchase return not found'
            });
        }

        // Reverse stock if Posted
        if (purchaseReturn.status === 'Posted') {
            for (const item of purchaseReturn.items) {
                const whItem = await WHItem.findById(item.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const returnQty = parseFloat(item.quantity) || 0;
                    const newQty = previousQty + returnQty;

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
                        type: 'in',
                        qty: returnQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'purchase_return',
                        refId: purchaseReturn._id,
                        remarks: `DELETED: Purchase Return #${purchaseReturn.postingNumber || 'Draft'} (REVERSED)`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }

        await WHPurchaseReturn.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Purchase return deleted and stock reversed'
        });
    } catch (error) {
        console.error('Error deleting purchase return:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
