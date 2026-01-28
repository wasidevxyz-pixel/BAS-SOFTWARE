const express = require('express');
const router = express.Router();
const {
    getCommissions,
    createCommission,
    deleteCommission,
    getCommissionsList,
    getCommissionById
} = require('../controllers/employeeCommissionController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/list', authorize('admin', 'manager', 'accountant'), getCommissionsList);
router.get('/detail/:id', authorize('admin', 'manager', 'accountant'), getCommissionById);

router.route('/')
    .get(authorize('admin', 'manager', 'accountant'), getCommissions)
    .post(authorize('admin', 'manager', 'accountant'), createCommission);

router.route('/:id')
    .delete(authorize('admin', 'manager'), deleteCommission);

module.exports = router;
