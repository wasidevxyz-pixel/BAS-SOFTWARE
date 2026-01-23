const WHItem = require('../models/WHItem');
const WHStockLog = require('../models/WHStockLog');
const Store = require('../models/Store');

// @desc    Get all WH Items
// @route   GET /api/v1/wh-items
exports.getWHItems = async (req, res) => {
    try {
        let query;

        // Copy req.query
        const reqQuery = { ...req.query };

        // Fields to exclude
        const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
        removeFields.forEach(param => delete reqQuery[param]);

        // Create query string
        let queryStr = JSON.stringify(reqQuery);

        // Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        let queryObj = JSON.parse(queryStr);

        // Add search support
        if (req.query.search) {
            const searchRegex = { $regex: req.query.search, $options: 'i' };
            queryObj.$or = [
                { name: searchRegex },
                { itemsCode: searchRegex },
                { barcode: searchRegex }
            ];
        }

        // Finding resource
        query = WHItem.find(queryObj)
            .populate('company', 'name')
            .populate('category', 'name')
            .populate('itemClass', 'name')
            .populate('subClass', 'name')
            .populate('supplier', 'supplierName')
            .populate('stock.store', 'name');

        // Sort
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        // Executing query
        const items = await query;

        res.status(200).json({ success: true, count: items.length, data: items });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single WH Item
// @route   GET /api/v1/wh-items/:id
exports.getWHItem = async (req, res) => {
    try {
        const item = await WHItem.findById(req.params.id)
            .populate('company', 'name')
            .populate('category', 'name')
            .populate('itemClass', 'name')
            .populate('subClass', 'name')
            .populate('supplier', 'supplierName')
            .populate('stock.store', 'name');

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.status(200).json({ success: true, data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create WH Item
// @route   POST /api/v1/wh-items
exports.createWHItem = async (req, res) => {
    try {
        req.body.createdBy = req.user.id;

        // Ensure seqId is set
        if (!req.body.seqId) {
            const lastItem = await WHItem.findOne().sort({ seqId: -1 });
            req.body.seqId = lastItem ? lastItem.seqId + 1 : 1;
        }

        const item = await WHItem.create(req.body);
        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('Create WH Item Error:', error);
        res.status(400).json({ success: false, message: 'Error creating item', error: error.message });
    }
};

// @desc    Update WH Item
// @route   PUT /api/v1/wh-items/:id
exports.updateWHItem = async (req, res) => {
    try {
        let item = await WHItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        item = await WHItem.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: item });
    } catch (error) {
        console.error('Update WH Item Error:', error);
        res.status(400).json({ success: false, message: 'Error updating item', error: error.message });
    }
};

// @desc    Delete WH Item
// @route   DELETE /api/v1/wh-items/:id
exports.deleteWHItem = async (req, res) => {
    try {
        const item = await WHItem.findByIdAndDelete(req.params.id);

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.status(200).json({ success: true, message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Next Seq ID and Item Code
// @route   GET /api/v1/wh-items/next-seq
exports.getNextSeqId = async (req, res) => {
    try {
        // Get Next Seq ID
        const lastItem = await WHItem.findOne().sort({ seqId: -1 });
        const nextId = lastItem ? lastItem.seqId + 1 : 1;

        // Get Next Item Code (Auto-generate starting from 2000)
        let nextCode = 2000;

        try {
            const result = await WHItem.aggregate([
                {
                    $match: {
                        itemsCode: { $regex: /^\d{1,9}$/ } // Match numeric codes up to 9 digits (exclude EAN-13/UPC)
                    }
                },
                {
                    $project: {
                        codeNum: { $toInt: "$itemsCode" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        maxCode: { $max: "$codeNum" }
                    }
                }
            ]);

            if (result.length > 0 && result[0].maxCode >= 2000) {
                nextCode = result[0].maxCode + 1;
            }
        } catch (aggError) {
            console.error('Aggregation error in getNextSeqId:', aggError);
            // If aggregation fails, try simple approach with length check
            const items = await WHItem.find({ itemsCode: { $regex: /^\d{1,9}$/ } })
                .collation({ locale: "en_US", numericOrdering: true }) // Ensure numeric sort
                .sort({ itemsCode: -1 })
                .limit(1);

            if (items.length > 0) {
                const maxCode = parseInt(items[0].itemsCode);
                if (!isNaN(maxCode) && maxCode >= 2000) {
                    nextCode = maxCode + 1;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                seqId: nextId,
                itemCode: nextCode.toString()
            }
        });
    } catch (error) {
        console.error('Error in getNextSeqId:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Import Stock from Excel (Matching by Name)
// @route   POST /api/v1/wh-items/import-stock
exports.importStock = async (req, res) => {
    try {
        const { stockData } = req.body;
        if (!stockData || !Array.isArray(stockData)) {
            return res.status(400).json({ success: false, message: 'Invalid stock data' });
        }

        // Get default store (first active store)
        let store = await Store.findOne({ isActive: true });
        if (!store) {
            return res.status(400).json({ success: false, message: 'No active store found to import stock' });
        }

        let importCount = 0;
        let skipCount = 0;
        let errors = [];

        for (const row of stockData) {
            try {
                const itemName = row.ItemName || row.name;
                const barcode = row.Barcode || row.barcode;
                const stockQty = parseFloat(row['Stock in Hand'] || row.stock || 0);

                if (!itemName) {
                    skipCount++;
                    continue;
                }

                // Search by name only as requested
                const item = await WHItem.findOne({ name: { $regex: new RegExp(`^${itemName}$`, 'i') } });

                if (!item) {
                    skipCount++;
                    continue;
                }

                const prevQty = (item.stock && item.stock.length > 0) ? item.stock[0].quantity : 0;

                // Update or Init Stock
                if (item.stock && item.stock.length > 0) {
                    item.stock[0].opening = stockQty;
                    item.stock[0].quantity = stockQty;
                } else {
                    item.stock = [{
                        store: store._id,
                        quantity: stockQty,
                        opening: stockQty
                    }];
                }

                item.markModified('stock');
                await item.save();

                // Create Stock Log
                await WHStockLog.create({
                    item: item._id,
                    date: new Date(),
                    type: 'in',
                    qty: stockQty,
                    previousQty: prevQty,
                    newQty: stockQty,
                    refType: 'purchase', // Using purchase as a generic refType for opening stock if 'Opening' not available
                    refId: item._id, // Self-reference for opening
                    remarks: 'Opening Stock Import from Excel',
                    createdBy: req.user.id
                });

                importCount++;
            } catch (err) {
                console.error(`Error importing item ${row.ItemName}:`, err);
                errors.push(`${row.ItemName}: ${err.message}`);
            }
        }

        res.status(200).json({
            success: true,
            message: `Import completed: ${importCount} updated, ${skipCount} skipped/not found, ${errors.length} errors`,
            details: { importCount, skipCount, errorCount: errors.length, errors }
        });
    } catch (error) {
        console.error('Import Stock Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
