const express = require('express');
const router = express.Router();
const {
    getPayrolls,
    getPayroll,
    calculatePayroll,
    createPayroll,
    updatePayroll,
    deletePayroll
} = require('../controllers/payrollController');

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.route('/')
    .get(authorize('admin', 'manager', 'accountant'), getPayrolls)
    .post(authorize('admin', 'manager', 'accountant'), createPayroll);

router.route('/calculate')
    .post(authorize('admin', 'manager', 'accountant'), calculatePayroll);

router.route('/:id')
    .get(authorize('admin', 'manager', 'accountant'), getPayroll)
    .put(authorize('admin', 'manager', 'accountant'), updatePayroll)
    .delete(authorize('admin', 'manager'), deletePayroll);

module.exports = router;
