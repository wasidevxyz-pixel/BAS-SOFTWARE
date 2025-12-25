const express = require('express');
const router = express.Router();
const {
    getEmployeeAdvances,
    getEmployeeAdvance,
    createEmployeeAdvance,
    updateEmployeeAdvance,
    deleteEmployeeAdvance
} = require('../controllers/employeeAdvanceController');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .get(protect, getEmployeeAdvances)
    .post(protect, authorize('admin', 'manager'), createEmployeeAdvance);

router.route('/:id')
    .get(protect, getEmployeeAdvance)
    .put(protect, authorize('admin', 'manager'), updateEmployeeAdvance)
    .delete(protect, authorize('admin'), deleteEmployeeAdvance);

module.exports = router;
