const express = require('express');
const router = express.Router();
const {
    getBanks,
    getBank,
    createBank,
    updateBank,
    deleteBank,
    createMissingBankLedgers
} = require('../controllers/bankController');

const { protect, authorize } = require('../middleware/auth');

// Specific routes MUST come before parameterized routes
router.route('/create-missing-ledgers')
    .post(protect, authorize('admin'), createMissingBankLedgers);

router.route('/')
    .get(protect, getBanks)
    .post(protect, authorize('admin', 'manager'), createBank);

router.route('/:id')
    .get(protect, getBank)
    .put(protect, authorize('admin', 'manager'), updateBank)
    .delete(protect, authorize('admin'), deleteBank);


module.exports = router;
