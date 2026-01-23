const WHSale = require('../models/WHSale');
const WHItem = require('../models/WHItem');
const WHCustomer = require('../models/WHCustomer');
const WHStockLog = require('../models/WHStockLog');
const { addLedgerEntry, deleteLedgerEntry } = require('../utils/whLedgerUtils');


// @desc    Create new WH Sale
// @route   POST /api/v1/wh-sales
exports.createWHSale = async (req, res) => {
    try {
        const saleData = {
            ...req.body,
            createdBy: req.user ? req.user._id : null
        };

        const sale = await WHSale.create(saleData);

        // Update Stock if Status is Posted
        if (sale.status === 'Posted') {
            for (const line of sale.items) {
                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const saleQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty - saleQty;

                    if (newQty < 0) {
                        throw new Error(`Insufficient stock for item: ${whItem.name}. Available: ${previousQty}, Sale: ${saleQty}`);
                    }

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
                        date: sale.invoiceDate,
                        type: 'out',
                        qty: saleQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'sale',
                        refId: sale._id,
                        remarks: `Sale #${sale.invoiceNo}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }

            // Add Ledger Entry for Posted Sale
            await addLedgerEntry({
                customer: sale.customer,
                date: sale.invoiceDate,
                description: `Credit Sale - Invoice #${sale.invoiceNo}`,
                refType: 'Sale',
                refId: sale._id,
                debit: sale.netTotal,
                credit: (sale.payMode === 'Cash' || sale.payMode === 'Bank') ? sale.paidAmount : 0,
                createdBy: req.user ? req.user._id : null
            });
        }


        res.status(201).json({ success: true, data: sale });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get all WH Sales
// @route   GET /api/v1/wh-sales
exports.getWHSales = async (req, res) => {
    try {
        const sales = await WHSale.find()
            .populate('customer', 'customerName')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: sales.length, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get single WH Sale
// @route   GET /api/v1/wh-sales/:id
exports.getWHSale = async (req, res) => {
    try {
        const sale = await WHSale.findById(req.params.id)
            .populate('customer')
            .populate({
                path: 'items.item',
                populate: [
                    { path: 'itemClass' },
                    { path: 'company' }
                ]
            })
            .populate('whCategory');
        if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });
        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update WH Sale
// @route   PUT /api/v1/wh-sales/:id
exports.updateWHSale = async (req, res) => {
    try {
        let sale = await WHSale.findById(req.params.id);
        if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });

        const existingStatus = sale.status;
        const oldItems = JSON.parse(JSON.stringify(sale.items)); // Deep copy old items

        sale = await WHSale.findByIdAndUpdate(req.params.id, req.body, { new: true });

        // CASE 1: Transitioning to Posted OR already Posted (Modifying)
        if (sale.status === 'Posted') {
            // If it was already Posted, reverse the OLD impact first
            if (existingStatus === 'Posted') {
                for (const line of oldItems) {
                    const whItem = await WHItem.findById(line.item);
                    if (whItem) {
                        const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                        const oldSaleQty = parseFloat(line.quantity) || 0;
                        const newQty = previousQty + oldSaleQty; // Reverse Sale: ADD back

                        if (whItem.stock && whItem.stock.length > 0) {
                            whItem.stock[0].quantity = newQty;
                        } else {
                            whItem.stock = [{ quantity: newQty, opening: 0 }];
                        }
                        whItem.markModified('stock');
                        await whItem.save();

                        await WHStockLog.create({
                            item: whItem._id,
                            date: sale.invoiceDate,
                            type: 'in',
                            qty: oldSaleQty,
                            previousQty: previousQty,
                            newQty: newQty,
                            refType: 'sale',
                            refId: sale._id,
                            remarks: `REVERSED (Update) Sale #${sale.invoiceNo}`,
                            createdBy: req.user ? req.user._id : null
                        });
                    }
                }
            }

            // Apply NEW impact
            for (const line of sale.items) {
                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const saleQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty - saleQty;

                    if (newQty < 0) {
                        throw new Error(`Insufficient stock for item: ${whItem.name}. Available: ${previousQty}, Sale: ${saleQty}`);
                    }

                    if (whItem.stock && whItem.stock.length > 0) {
                        whItem.stock[0].quantity = newQty;
                    } else {
                        whItem.stock = [{ quantity: newQty, opening: 0 }];
                    }
                    whItem.markModified('stock');
                    await whItem.save();

                    await WHStockLog.create({
                        item: whItem._id,
                        date: sale.invoiceDate,
                        type: 'out',
                        qty: saleQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'sale',
                        refId: sale._id,
                        remarks: `Updated Sale #${sale.invoiceNo}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }

            // Sync Ledger for Posted Sale
            await deleteLedgerEntry(sale._id, {
                customer: sale.customer,
                debit: sale.netTotal,
                credit: (sale.payMode === 'Cash' || sale.payMode === 'Bank') ? sale.paidAmount : 0
            });
            await addLedgerEntry({
                customer: sale.customer,
                date: sale.invoiceDate,
                description: `Credit Sale (Updated) - Invoice #${sale.invoiceNo}`,
                refType: 'Sale',
                refId: sale._id,
                debit: sale.netTotal,
                credit: (sale.payMode === 'Cash' || sale.payMode === 'Bank') ? sale.paidAmount : 0,
                createdBy: req.user ? req.user._id : null
            });
        }

        // CASE 2: Transitioning from Posted to Draft
        else if (existingStatus === 'Posted') {
            await deleteLedgerEntry(sale._id, {
                customer: sale.customer,
                debit: sale.netTotal,
                credit: (sale.payMode === 'Cash' || sale.payMode === 'Bank') ? sale.paidAmount : 0
            });
            for (const line of oldItems) {

                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const oldSaleQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty + oldSaleQty;

                    if (whItem.stock && whItem.stock.length > 0) {
                        whItem.stock[0].quantity = newQty;
                    } else {
                        whItem.stock = [{ quantity: newQty, opening: 0 }];
                    }
                    whItem.markModified('stock');
                    await whItem.save();

                    await WHStockLog.create({
                        item: whItem._id,
                        date: sale.invoiceDate,
                        type: 'in',
                        qty: oldSaleQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'sale',
                        refId: sale._id,
                        remarks: `Unposted Sale #${sale.invoiceNo}`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
        }
        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Delete WH Sale
// @route   DELETE /api/v1/wh-sales/:id
exports.deleteWHSale = async (req, res) => {
    try {
        const sale = await WHSale.findById(req.params.id);
        if (!sale) return res.status(404).json({ success: false, error: 'Sale not found' });

        if (sale.status === 'Posted') {
            for (const line of sale.items) {
                const whItem = await WHItem.findById(line.item);
                if (whItem) {
                    const previousQty = (whItem.stock && whItem.stock.length > 0) ? whItem.stock[0].quantity : 0;
                    const saleQty = parseFloat(line.quantity) || 0;
                    const newQty = previousQty + saleQty;

                    if (whItem.stock && whItem.stock.length > 0) {
                        whItem.stock[0].quantity = newQty;
                    } else {
                        whItem.stock = [{ quantity: newQty, opening: 0 }];
                    }
                    whItem.markModified('stock');
                    await whItem.save();

                    await WHStockLog.create({
                        item: whItem._id,
                        date: sale.invoiceDate,
                        type: 'in',
                        qty: saleQty,
                        previousQty: previousQty,
                        newQty: newQty,
                        refType: 'sale',
                        refId: sale._id,
                        remarks: `DELETED: Sale #${sale.invoiceNo} (REVERSED)`,
                        createdBy: req.user ? req.user._id : null
                    });
                }
            }
            await deleteLedgerEntry(sale._id, {
                customer: sale.customer,
                debit: sale.netTotal,
                credit: (sale.payMode === 'Cash' || sale.payMode === 'Bank') ? sale.paidAmount : 0
            });
        }

        await sale.deleteOne();
        res.status(200).json({ success: true, message: 'Sale deleted and stock reversed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get next invoice number
// @route   GET /api/v1/wh-sales/next-number
exports.getNextInvoiceNumber = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year + 1, 0, 1);

        const count = await WHSale.countDocuments({
            createdAt: { $gte: startOfYear, $lt: endOfYear }
        });

        const nextNo = `INV-WS-${year}-${String(count + 1).padStart(4, '0')}`;
        res.status(200).json({ success: true, data: nextNo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
