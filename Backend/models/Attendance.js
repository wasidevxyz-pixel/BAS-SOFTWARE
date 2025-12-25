const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    branch: {
        type: String,
        default: 'F-6'
    },
    code: String,
    busyHours: {
        type: Number,
        default: 12
    },
    // Check In/Out Times
    checkIn: String,
    checkOut: String,
    workedHrs: String,
    breakHrs: String,
    // Time Differences
    timeDiffIn: String,
    timeDiffOut: String,
    totalDiffHrs: String,
    totalHrs: {
        type: Number,
        default: 0
    },
    // Display Status
    displayStatus: {
        type: String,
        enum: ['Present', 'Absent', 'Leave', 'Half Day'],
        default: 'Present'
    },
    remarks: String,
    isPresent: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index for employee and date
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
