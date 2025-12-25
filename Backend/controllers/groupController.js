const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Group = require('../models/Group');
const User = require('../models/User');

// @desc    Get all groups
// @route   GET /api/v1/groups
// @access  Private/Admin
exports.getGroups = asyncHandler(async (req, res, next) => {
    const groups = await Group.find();

    res.status(200).json({
        success: true,
        count: groups.length,
        data: groups
    });
});

// @desc    Get single group
// @route   GET /api/v1/groups/:id
// @access  Private/Admin
exports.getGroup = asyncHandler(async (req, res, next) => {
    const group = await Group.findById(req.params.id);

    if (!group) {
        return next(new ErrorResponse(`Group not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({
        success: true,
        data: group
    });
});

// @desc    Create group
// @route   POST /api/v1/groups
// @access  Private/Admin
exports.createGroup = asyncHandler(async (req, res, next) => {
    const group = await Group.create(req.body);

    res.status(201).json({
        success: true,
        data: group
    });
});

// @desc    Update group
// @route   PUT /api/v1/groups/:id
// @access  Private/Admin
exports.updateGroup = asyncHandler(async (req, res, next) => {
    let group = await Group.findById(req.params.id);

    if (!group) {
        return next(new ErrorResponse(`Group not found with id of ${req.params.id}`, 404));
    }

    group = await Group.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: group
    });
});

// @desc    Delete group
// @route   DELETE /api/v1/groups/:id
// @access  Private/Admin
exports.deleteGroup = asyncHandler(async (req, res, next) => {
    const group = await Group.findById(req.params.id);

    if (!group) {
        return next(new ErrorResponse(`Group not found with id of ${req.params.id}`, 404));
    }

    // Check if any user is assigned to this group
    const userCount = await User.countDocuments({ groupId: req.params.id });
    if (userCount > 0) {
        return next(new ErrorResponse(`Cannot delete group. ${userCount} users are assigned to it.`, 400));
    }

    await group.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});
