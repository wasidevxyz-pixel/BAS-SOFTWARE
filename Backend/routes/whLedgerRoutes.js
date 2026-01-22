const express = require('express');
const router = express.Router();
const { getWHLedgerReport, getWHCustomerBalances } = require('../controllers/whLedgerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/report', getWHLedgerReport);
router.get('/balances', getWHCustomerBalances);

module.exports = router;
