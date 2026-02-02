const express = require('express');
const router = express.Router();
const {
    getEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getNextCode
} = require('../controllers/employeeController');

const { protect, authorize } = require('../middleware/auth');
const { verifyApiKey } = require('../middleware/apiAuth');

router.get('/next-code', protect, getNextCode);

router.route('/')
    .get(verifyApiKey, protect, getEmployees)
    .post(protect, authorize('admin', 'manager'), createEmployee);

router.route('/:id')
    .get(protect, getEmployee)
    .put(protect, authorize('admin', 'manager'), updateEmployee)
    .delete(protect, authorize('admin'), deleteEmployee);

module.exports = router;
