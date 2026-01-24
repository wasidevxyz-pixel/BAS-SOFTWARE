const express = require('express');
const router = express.Router();
const {
    getEmployeeDepartments,
    getEmployeeDepartment,
    createEmployeeDepartment,
    updateEmployeeDepartment,
    deleteEmployeeDepartment
} = require('../controllers/employeeDepartmentController');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .get(protect, getEmployeeDepartments)
    .post(protect, authorize('admin', 'manager'), createEmployeeDepartment);

router.route('/:id')
    .get(protect, getEmployeeDepartment)
    .put(protect, authorize('admin', 'manager'), updateEmployeeDepartment)
    .delete(protect, authorize('admin'), deleteEmployeeDepartment);

module.exports = router;
