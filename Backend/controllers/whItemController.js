const WHItem = require('../models/WHItem');

// @desc    Get all WH Items
// @route   GET /api/v1/wh-items
exports.getWHItems = async (req, res) => {
    try {
        let query;

        // Copy req.query
        const reqQuery = { ...req.query };

        // Fields to exclude
        const removeFields = ['select', 'sort', 'page', 'limit'];
        removeFields.forEach(param => delete reqQuery[param]);

        // Create query string
        let queryStr = JSON.stringify(reqQuery);

        // Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        // Finding resource
        query = WHItem.find(JSON.parse(queryStr))
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
        const result = await WHItem.aggregate([
            {
                $match: {
                    itemsCode: { $regex: /^\d+$/ } // Match only numeric item codes
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

        let nextCode = 2000;
        if (result.length > 0 && result[0].maxCode >= 2000) {
            nextCode = result[0].maxCode + 1;
        }

        res.status(200).json({
            success: true,
            data: {
                seqId: nextId,
                itemCode: nextCode.toString()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
