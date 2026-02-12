const express = require('express');
const router = express.Router();
const {
    getEmployeeAdvances,
    getEmployeeAdvance,
    createEmployeeAdvance,
    updateEmployeeAdvance,
    deleteEmployeeAdvance,
    getAdvancePayRecReport
} = require('../controllers/employeeAdvanceController');

const { protect, authorize } = require('../middleware/auth');

router.get('/report', protect, getAdvancePayRecReport);

router.route('/')
    .get(protect, getEmployeeAdvances)
    .post(protect, authorize('admin', 'manager', 'employee_advance'), createEmployeeAdvance);

router.route('/:id')
    .get(protect, getEmployeeAdvance)
    .put(protect, authorize('admin', 'manager', 'employee_advance'), updateEmployeeAdvance)
    .delete(protect, authorize('admin'), deleteEmployeeAdvance);

module.exports = router;
