const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const incomeStatementController = require('../controllers/incomeStatementController');

// @route   GET /api/v1/income-statement
// @desc    Get Income Statement Report
// @access  Private
router.get('/', protect, incomeStatementController.getIncomeStatement);

module.exports = router;
