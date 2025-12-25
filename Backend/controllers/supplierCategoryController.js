const Category = require('../models/Category');

// @desc    Get all supplier categories
// @route   GET /api/v1/supplier-categories
// @access  Private
exports.getSupplierCategories = async (req, res) => {
    try {
        const categories = await Category.find({
            categoryType: 'supplier',
            isActive: true
        }).sort('name');

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error('Error fetching supplier categories:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching supplier categories'
        });
    }
};

// @desc    Get single supplier category
// @route   GET /api/v1/supplier-categories/:id
// @access  Private
exports.getSupplierCategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            categoryType: 'supplier'
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Supplier category not found'
            });
        }

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error fetching supplier category:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching supplier category'
        });
    }
};

// @desc    Create new supplier category
// @route   POST /api/v1/supplier-categories
// @access  Private
exports.createSupplierCategory = async (req, res) => {
    try {
        // Force categoryType to 'supplier' - user doesn't need to specify
        req.body.categoryType = 'supplier';
        req.body.createdBy = req.user.id;

        const category = await Category.create(req.body);

        res.status(201).json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error creating supplier category:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Supplier category with this name already exists'
            });
        }

        res.status(400).json({
            success: false,
            message: error.message || 'Failed to create supplier category'
        });
    }
};

// @desc    Update supplier category
// @route   PUT /api/v1/supplier-categories/:id
// @access  Private
exports.updateSupplierCategory = async (req, res) => {
    try {
        // Prevent changing categoryType
        delete req.body.categoryType;

        const category = await Category.findOneAndUpdate(
            { _id: req.params.id, categoryType: 'supplier' },
            req.body,
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Supplier category not found'
            });
        }

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error updating supplier category:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update supplier category'
        });
    }
};

// @desc    Delete supplier category (soft delete)
// @route   DELETE /api/v1/supplier-categories/:id
// @access  Private
exports.deleteSupplierCategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            categoryType: 'supplier'
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Supplier category not found'
            });
        }

        // Soft delete - just mark as inactive
        category.isActive = false;
        await category.save();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error('Error deleting supplier category:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting supplier category'
        });
    }
};
