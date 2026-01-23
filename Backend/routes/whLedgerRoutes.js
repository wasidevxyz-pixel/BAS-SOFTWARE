const express = require('express');
const router = express.Router();
const { getWHLedgerReport, getWHCustomerBalances, getWHStockPosition, getWHItemLedger, getWHStockActivity } = require('../controllers/whLedgerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/report', getWHLedgerReport);
router.get('/balances', getWHCustomerBalances);
router.get('/stock-position', getWHStockPosition);
router.get('/item-ledger', getWHItemLedger);
router.get('/stock-activity', getWHStockActivity);

module.exports = router;
