const express = require('express');
const router = express.Router();
const {
    getAttendance,
    getSingleAttendance,
    createAttendance,
    updateAttendance,
    bulkCreateAttendance,
    deleteAttendance
} = require('../controllers/attendanceController');

const { protect, authorize } = require('../middleware/auth');
const { verifyApiKey } = require('../middleware/apiAuth');

router.route('/')
    .get(verifyApiKey, protect, getAttendance)
    .post(verifyApiKey, protect, authorize('admin', 'manager'), createAttendance);

router.route('/bulk')
    .post(verifyApiKey, protect, authorize('admin', 'manager'), bulkCreateAttendance);

router.route('/:id')
    .get(protect, getSingleAttendance)
    .put(protect, authorize('admin', 'manager'), updateAttendance)
    .delete(protect, authorize('admin'), deleteAttendance);

module.exports = router;
