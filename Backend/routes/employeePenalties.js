const express = require('express');
const router = express.Router();
const {
    getPenalties,
    createPenalty,
    deletePenalty
} = require('../controllers/employeePenaltyController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(authorize('admin', 'manager', 'accountant'), getPenalties)
    .post(authorize('admin', 'manager'), createPenalty);

router.route('/:id')
    .delete(authorize('admin', 'manager'), deletePenalty);

module.exports = router;
