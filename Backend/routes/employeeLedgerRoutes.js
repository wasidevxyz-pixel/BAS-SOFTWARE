const express = require('express');
const { getEmployeeLedger, getCurrentBalance, rebuildLedger } = require('../controllers/employeeLedgerController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/rebuild')
    .post(authorize('admin', 'manager'), rebuildLedger);

router.route('/:employeeId')
    .get(getEmployeeLedger);

router.route('/balance/:employeeId')
    .get(getCurrentBalance);


module.exports = router;
