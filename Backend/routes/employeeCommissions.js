const express = require('express');
const router = express.Router();
const {
    getCommissions,
    createCommission,
    deleteCommission
} = require('../controllers/employeeCommissionController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(authorize('admin', 'manager', 'accountant'), getCommissions)
    .post(authorize('admin', 'manager', 'accountant'), createCommission);

router.route('/:id')
    .delete(authorize('admin', 'manager'), deleteCommission);

module.exports = router;
