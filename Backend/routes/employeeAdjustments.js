const express = require('express');
const router = express.Router();
const {
    getAdjustments,
    createAdjustment,
    deleteAdjustment
} = require('../controllers/employeeAdjustmentController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(authorize('admin', 'manager', 'accountant'), getAdjustments)
    .post(authorize('admin', 'manager', 'accountant'), createAdjustment);

router.route('/:id')
    .delete(authorize('admin', 'manager'), deleteAdjustment);

module.exports = router;
