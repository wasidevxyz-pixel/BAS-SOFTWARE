const express = require('express');
const router = express.Router();
const { getWHLedgerReport, getWHCustomerBalances, getWHStockPosition } = require('../controllers/whLedgerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/report', getWHLedgerReport);
router.get('/balances', getWHCustomerBalances);
router.get('/stock-position', getWHStockPosition);

module.exports = router;
