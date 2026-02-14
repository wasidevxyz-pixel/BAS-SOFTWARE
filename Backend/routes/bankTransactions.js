const express = require('express');
const router = express.Router();
const {
  getBankTransactions,
  getBankTransaction,
  createBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
  getBankBookSummary,
  getBankList,
  verifyBankTransactions
} = require('../controllers/bankTransactionController');
const { protect, accountsAccess, adminAccess, managerAccess } = require('../middleware/auth');

// Static routes
router.get('/', protect, accountsAccess, getBankTransactions);
router.post('/', protect, accountsAccess, createBankTransaction);
router.get('/summary', protect, accountsAccess, getBankBookSummary);
router.get('/banks', protect, accountsAccess, getBankList);

// Bulk Update - Changed name to avoid conflict with /:id
router.put('/bulk-verify-status', protect, accountsAccess, verifyBankTransactions);

// ID routes
router.get('/:id', protect, accountsAccess, getBankTransaction);
router.put('/:id', protect, accountsAccess, updateBankTransaction);
router.delete('/:id', protect, adminAccess, deleteBankTransaction);

module.exports = router;
