const express = require('express');
const router = express.Router();
const {
    getDailyCash,
    createDailyCash,
    updateDailyCash,
    deleteDailyCash,
    verifyDailyCash
} = require('../controllers/dailyCashController');

const { protect } = require('../middleware/auth');

// Helper search
router.get('/', protect, getDailyCash);
router.post('/', protect, createDailyCash);

// Bulk Update - Changed name to avoid conflict with /:id
router.put('/bulk-verify-status', protect, verifyDailyCash);

// Single record updates
router.put('/:id', protect, updateDailyCash);
router.delete('/:id', protect, deleteDailyCash);

module.exports = router;
