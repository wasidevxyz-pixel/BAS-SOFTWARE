const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
    const users = await User.find().select('-password').populate('groupId');

    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json(user);
});

// @desc    Create user
// @route   POST /api/v1/users
// @access  Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
    const { name, email, password, groupId, isActive, permissions, branch, department, zakat, userType, saleDeleteLimit } = req.body;

    const user = await User.create({
        name,
        email,
        password,
        groupId,
        isActive,
        permissions,
        branch,
        department,
        zakat,
        userType,
        saleDeleteLimit
    });

    res.status(201).json({
        success: true,
        data: user
    });
});

// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
    const fieldsToUpdate = { ...req.body };

    // If password is blank or not provided, delete it so it doesn't get overwritten with blank/undefined
    if (!fieldsToUpdate.password) {
        delete fieldsToUpdate.password;
    }

    let user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    // If password is being updated, we need to handle it separately or let pre-save hook handle it 
    // findByIdAndUpdate bypasses pre-save hooks normally unless setup carefully, 
    // but User.js has pre('save').
    // Better to use save() if updating password.

    if (fieldsToUpdate.password) {
        user.password = fieldsToUpdate.password;
        delete fieldsToUpdate.password; // Remove from spread object
        Object.assign(user, fieldsToUpdate);
        await user.save();
    } else {
        user = await User.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    await user.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Update user status (active/inactive)
// @route   PUT /api/v1/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = asyncHandler(async (req, res, next) => {
    const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: req.body.isActive },
        { new: true, runValidators: true }
    );

    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({
        success: true,
        data: user
    });
});
