const Attendance = require('../models/Attendance');

// @desc    Get attendance records
// @route   GET /api/v1/attendance
exports.getAttendance = async (req, res) => {
    try {
        const { from, to, branch, department, designation } = req.query;

        let query = {};

        if (from && to) {
            query.date = { $gte: new Date(from), $lte: new Date(to) };
        }
        if (branch) query.branch = branch;

        const attendance = await Attendance.find(query)
            .populate({
                path: 'employee',
                populate: { path: 'department' }
            })
            .sort({ date: -1 });

        res.status(200).json({ success: true, data: attendance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single attendance
// @route   GET /api/v1/attendance/:id
exports.getSingleAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.findById(req.params.id).populate('employee');
        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance not found' });
        }
        res.status(200).json({ success: true, data: attendance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create/Update attendance
// @route   POST /api/v1/attendance
exports.createAttendance = async (req, res) => {
    try {
        const { employee, date } = req.body;

        // Check if attendance already exists for this employee and date
        let attendance = await Attendance.findOne({ employee, date });

        if (attendance) {
            // Update existing
            attendance = await Attendance.findByIdAndUpdate(attendance._id, req.body, {
                new: true,
                runValidators: true
            });
        } else {
            // Create new
            attendance = await Attendance.create(req.body);
        }

        res.status(201).json({ success: true, data: attendance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Bulk create/update attendance
// @route   POST /api/v1/attendance/bulk
exports.bulkCreateAttendance = async (req, res) => {
    try {
        const { attendanceRecords } = req.body;

        const results = [];
        for (const record of attendanceRecords) {
            const { employee, date } = record;
            let attendance = await Attendance.findOne({ employee, date });

            if (attendance) {
                attendance = await Attendance.findByIdAndUpdate(attendance._id, record, {
                    new: true,
                    runValidators: true
                });
            } else {
                attendance = await Attendance.create(record);
            }
            results.push(attendance);
        }

        res.status(201).json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete attendance
// @route   DELETE /api/v1/attendance/:id
exports.deleteAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.findByIdAndDelete(req.params.id);
        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
