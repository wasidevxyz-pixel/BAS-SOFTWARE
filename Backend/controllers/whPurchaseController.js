const WHPurchase = require('../models/WHPurchase');
const WHItem = require('../models/WHItem');
const WHSupplier = require('../models/WHSupplier');

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

        // Update Stock (Optional: typically on 'Posted' status)
        // For simplicity, we assume strictly transactional recording for now
        // Or we can increment WHItem stock here if needed. 
        // Let's implement stock update logic if status is Posted
        if (purchase.status === 'Posted') {
            for (const line of purchase.items) {
                // Find item and update stock
                // Assuming WHItem has a simplified stock field or specific store logic
                // For now, we'll just log or skip specific stock logic until specified
                // as WHItem schema has a 'stock' array for stores.
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
            .populate('items.item');

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

        purchase = await WHPurchase.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

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

        await purchase.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
