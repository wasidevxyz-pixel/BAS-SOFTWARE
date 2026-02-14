const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');


// @desc    Get attendance records
// @route   GET /api/v1/attendance
exports.getAttendance = async (req, res) => {
    try {
        const { from, to, branch, department, designation, employee } = req.query;

        let query = {};

        if (from && to) {
            query.date = { $gte: new Date(from), $lte: new Date(to) };
        }
        if (branch) query.branch = branch;
        if (employee) query.employee = employee;

        const attendance = await Attendance.find(query)
            .populate({
                path: 'employee',
                populate: [
                    { path: 'department' },
                    { path: 'designation' }
                ]
            })
            .sort({ date: -1 });

        // Filter by dept/desig after population if needed
        let filteredData = attendance;
        if (department || designation) {
            filteredData = attendance.filter(att => {
                let match = true;
                if (department && att.employee?.department?._id.toString() !== department) match = false;
                if (designation && att.employee?.designation?._id.toString() !== designation) match = false;
                return match;
            });
        }

        res.status(200).json({ success: true, data: filteredData });
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

// @desc    Update attendance
// @route   PUT /api/v1/attendance/:id
exports.updateAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance not found' });
        }

        res.status(200).json({ success: true, data: attendance });
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

// @desc    Get total count of unique present employees
// @route   GET /api/v1/attendance/total-present
exports.getTotalPresentEmployee = async (req, res) => {
    try {
        const {
            F_Dated,
            T_Dated,
            Employee_ID,
            Department_ID,
            Designation_ID,
            Branch_ID,
            Criteria
        } = req.query;

        // Match Stage (Only Date)
        // User Requirement: "check in out when complete when present day will count on payroll"
        // This means we need:
        // 1. Status to be Present/P
        // 2. checkIn to be present (not null/empty)
        // 3. checkOut to be present (not null/empty)
        const matchStage = {
            displayStatus: { $in: ['Present', 'P'] },
            checkIn: { $exists: true, $ne: '' },
            checkOut: { $exists: true, $ne: '' }
        };

        // Date Range Filter
        if (F_Dated && T_Dated) {
            matchStage.date = {
                $gte: new Date(F_Dated),
                $lte: new Date(T_Dated)
            };
        } else if (F_Dated) {
            matchStage.date = { $gte: new Date(F_Dated) };
        }

        // Branch filter is applied AFTER lookup to ensure correct branch assignment (especially if attendance branch field is missing)

        // Employee Match
        if (Employee_ID && Employee_ID !== '0' && Employee_ID !== 'null' && Employee_ID !== '') {
            matchStage.employee = new mongoose.Types.ObjectId(Employee_ID);
        }

        // Pipeline Construction
        const pipeline = [
            { $match: matchStage },
            // Lookup Employee details for Branch/Dept/Designation filtering
            {
                $lookup: {
                    from: 'employees',
                    localField: 'employee',
                    foreignField: '_id',
                    as: 'empDetails'
                }
            },
            { $unwind: '$empDetails' }
        ];

        // Filters that require Employee Lookup
        const empMatch = {};

        // Branch Match (Applied via Employee details now)
        if (Branch_ID && Branch_ID !== '0' && Branch_ID !== 'null' && Branch_ID !== '') {
            const escapedBranch = Branch_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            empMatch['empDetails.branch'] = { $regex: escapedBranch, $options: 'i' };
        }

        if (Department_ID && Department_ID !== '0' && Department_ID !== 'null' && Department_ID !== '') {
            empMatch['empDetails.department'] = new mongoose.Types.ObjectId(Department_ID);
        }

        if (Designation_ID && Designation_ID !== '0' && Designation_ID !== 'null' && Designation_ID !== '') {
            empMatch['empDetails.designation'] = new mongoose.Types.ObjectId(Designation_ID);
        }

        // Apply Criteria Filter (Search by Name or Code)
        if (Criteria) {
            empMatch['$or'] = [
                { 'empDetails.name': { $regex: Criteria, $options: 'i' } },
                { 'empDetails.code': { $regex: Criteria, $options: 'i' } }
            ];
        }

        // Add secondary match stage if there are employee-level filters
        if (Object.keys(empMatch).length > 0) {
            pipeline.push({ $match: empMatch });
        }

        // Group by Employee ID removed. We want total man-days.
        // pipeline.push({
        //     $group: {
        //         _id: '$employee'
        //     }
        // });

        // // Count the groups
        // pipeline.push({
        //     $count: 'totalPresent'
        // });

        // Count TOTAL RECORDS matching criteria (Man-Days)
        pipeline.push({
            $count: 'totalPresent'
        });

        const result = await Attendance.aggregate(pipeline);

        const count = result.length > 0 ? result[0].totalPresent : 0;

        res.status(200).json({
            success: true,
            count: count
        });

    } catch (error) {
        console.error('Aggregation Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
