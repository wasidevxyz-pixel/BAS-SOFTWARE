const express = require('express');
const router = express.Router();
const { checkBankLedgerData, fixBankLedgerNames } = require('../controllers/diagnosticController');

// Public endpoints for debugging - NO AUTHENTICATION
router.get('/bank-ledger-check', checkBankLedgerData);
router.get('/fix-bank-ledger-names', fixBankLedgerNames);

module.exports = router;
