const express = require('express');
const router = express.Router();
const {
    getClearances,
    createClearance,
    deleteClearance
} = require('../controllers/employeeClearanceController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(authorize('admin', 'manager', 'accountant'), getClearances)
    .post(authorize('admin', 'manager', 'accountant'), createClearance);

router.route('/:id')
    .delete(authorize('admin', 'manager'), deleteClearance);

module.exports = router;
