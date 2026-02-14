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
    .get(authorize('admin', 'manager', 'accountant', 'monthly_payroll'), getPayrolls)
    .post(authorize('admin', 'manager', 'accountant', 'monthly_payroll'), createPayroll);

router.route('/calculate')
    .post(authorize('admin', 'manager', 'accountant', 'monthly_payroll'), calculatePayroll);

router.route('/:id')
    .get(authorize('admin', 'manager', 'accountant', 'monthly_payroll'), getPayroll)
    .put(authorize('admin', 'manager', 'accountant', 'monthly_payroll'), updatePayroll)
    .delete(authorize('admin', 'manager'), deletePayroll);

module.exports = router;
