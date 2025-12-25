const express = require('express');
const router = express.Router();
const {
    getHolyDays,
    createHolyDay,
    updateHolyDay,
    deleteHolyDay
} = require('../controllers/holyDayController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(authorize('admin', 'manager', 'accountant'), getHolyDays)
    .post(authorize('admin', 'manager'), createHolyDay);

router.route('/:id')
    .put(authorize('admin', 'manager'), updateHolyDay)
    .delete(authorize('admin', 'manager'), deleteHolyDay);

module.exports = router;
