const express = require('express');
const router = express.Router();
const {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  getExpensesByDateRange,
  getExpensesSummary,
  getExpensesByCategory,
  getCashInHand
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const Expense = require('../models/Expense');

// Static routes MUST come BEFORE dynamic routes like /:id
router
  .route('/cash-in-hand')
  .get(protect, getCashInHand);

router
  .route('/date-range')
  .get(protect, getExpensesByDateRange);

router
  .route('/summary')
  .get(protect, getExpensesSummary);

router
  .route('/category/:category')
  .get(protect, getExpensesByCategory);

// Main CRUD routes
router
  .route('/')
  .get(protect, advancedResults(Expense, [
    { path: 'createdBy', select: 'name' },
    { path: 'approvedBy', select: 'name' }
  ]), getExpenses)
  .post(protect, createExpense);

// Dynamic routes with :id AFTER static routes
router
  .route('/:id')
  .get(protect, getExpense)
  .put(protect, updateExpense)
  .delete(protect, deleteExpense);

router
  .route('/:id/approve')
  .put(protect, authorize('admin', 'manager'), approveExpense);

module.exports = router;
