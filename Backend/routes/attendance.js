const express = require('express');
const router = express.Router();
const {
    getAttendance,
    getSingleAttendance,
    createAttendance,
    bulkCreateAttendance,
    deleteAttendance
} = require('../controllers/attendanceController');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .get(protect, getAttendance)
    .post(protect, authorize('admin', 'manager'), createAttendance);

router.route('/bulk')
    .post(protect, authorize('admin', 'manager'), bulkCreateAttendance);

router.route('/:id')
    .get(protect, getSingleAttendance)
    .delete(protect, authorize('admin'), deleteAttendance);

module.exports = router;
