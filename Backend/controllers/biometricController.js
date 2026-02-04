const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');

// @desc    Securely sync biometric logs from C# Desktop App
// @route   POST /api/v1/attendance/biometric
// @access  Private (Secret Key Required)
exports.syncBiometricLog = async (req, res) => {
    try {
        const secretKey = req.headers['bas-secret-key'];

        // 1. Verify Secret Key
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne({});
        const MASTER_SECRET = process.env.BIOMETRIC_SECRET || 'BAS_SECURE_TOKEN_XYZ';

        // Allow match with either ENV secret or the Database-stored API Secret
        const isAuthorized = (secretKey === MASTER_SECRET) || (settings && settings.apiSecret === secretKey);

        if (!isAuthorized) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Invalid Secret Key' });
        }

        const { employeeCode, type, timestamp, branch } = req.body;

        // 2. Find Employee and Department
        const employee = await Employee.findOne({ code: employeeCode }).populate('department');
        if (!employee) {
            return res.status(404).json({ success: false, message: `Employee with code ${employeeCode} not found` });
        }

        const logDate = new Date(timestamp || Date.now());
        const currentTimeInMinutes = logDate.getHours() * 60 + logDate.getMinutes();
        const timeStr = logDate.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

        // Get max checkout time for the department
        let maxCheckoutTimeStr = '03:00';
        if (employee.department && employee.department.maxCheckoutTime) {
            maxCheckoutTimeStr = employee.department.maxCheckoutTime;
        }
        let maxH = 3, maxM = 0;
        if (maxCheckoutTimeStr) {
            const cleanTime = maxCheckoutTimeStr.replace(/[a-zA-Z\s]/g, '');
            const parts = cleanTime.split(':').map(Number);
            if (parts.length >= 2 && !isNaN(parts[0])) {
                maxH = parts[0];
                maxM = parts[1];
            }
        }
        const maxCheckoutTimeInMinutes = maxH * 60 + maxM;

        // Determine Logic Date (Shift Date)
        let shiftDate = new Date(logDate);
        if (currentTimeInMinutes < maxCheckoutTimeInMinutes) {
            shiftDate.setDate(shiftDate.getDate() - 1);
        }
        const shiftDateStr = shiftDate.toISOString().split('T')[0];

        // 3. Find Attendance for the Shift Date
        let attendance = await Attendance.findOne({
            employee: employee._id,
            date: { $gte: new Date(shiftDateStr), $lt: new Date(new Date(shiftDateStr).setDate(new Date(shiftDateStr).getDate() + 1)) }
        });

        // 4. Smart Logic
        if (!attendance) {
            // Check if there is an existing record for TODAY specifically (in case logicDate was yesterday but no record there)
            const todayDateStr = logDate.toISOString().split('T')[0];
            if (shiftDateStr !== todayDateStr) {
                attendance = await Attendance.findOne({
                    employee: employee._id,
                    date: { $gte: new Date(todayDateStr), $lt: new Date(new Date(todayDateStr).setDate(new Date(todayDateStr).getDate() + 1)) }
                });
            }

            if (!attendance) {
                // NEW CHECK-IN
                attendance = new Attendance({
                    employee: employee._id,
                    date: new Date(logDate.toISOString().split('T')[0]),
                    branch: branch || employee.branch || 'Main',
                    displayStatus: 'Present',
                    isPresent: true,
                    checkIn: timeStr
                });
                await attendance.save();
                return res.status(200).json({
                    success: true,
                    message: "Check-IN successful",
                    data: { employee: employee.name, checkIn: timeStr, action: 'IN' }
                });
            }
        }

        // If attendance exists, check status
        if (!attendance.checkIn) {
            attendance.checkIn = timeStr;
            attendance.displayStatus = 'Present';
            attendance.isPresent = true;
            await attendance.save();
            return res.status(200).json({
                success: true,
                message: "Check-IN successful",
                data: { employee: employee.name, checkIn: timeStr, action: 'IN' }
            });
        }

        if (attendance.checkIn && attendance.checkOut) {
            // Allow UPDATING Check-Out if the new time is LATER than the stored time
            // This handles cases where an employee scans, then works more, then scans again.
            if (attendance.checkOut.trim() !== '' && attendance.checkOut !== '--:--') {
                // Compare times
                const [storedH, storedM] = attendance.checkOut.split(':').map(Number);
                const storedMinutes = storedH * 60 + storedM;

                // Handle midnight crossing for comparison
                let adjustedStoredMinutes = storedMinutes;
                let adjustedCurrentMinutes = currentTimeInMinutes;

                // If stored time is small (e.g. 02:00) and checkIn was large (e.g. 20:00), it's next day
                const [inH, inM] = attendance.checkIn.split(':').map(Number);
                const inMinutes = inH * 60 + inM;

                if (storedMinutes < inMinutes) adjustedStoredMinutes += 1440;
                if (currentTimeInMinutes < inMinutes) adjustedCurrentMinutes += 1440;

                // If trying to check out earlier than already recorded? Block.
                // If trying to check out later? Allow update.
                if (adjustedCurrentMinutes <= adjustedStoredMinutes) {
                    return res.status(400).json({ success: false, message: `Already checked out at ${attendance.checkOut}` });
                }
                // If we get here, we proceed to update the checkout time below!
            }
        }

        // 10-minute Rule Check
        const checkInTimeParts = attendance.checkIn.split(':').map(Number);
        const checkInMinutes = checkInTimeParts[0] * 60 + checkInTimeParts[1];

        let diffInMinutes;
        // If attendance was from "Yesterday" (Logic Date), calculate across mid-night
        if (attendance.date.toISOString().split('T')[0] !== logDate.toISOString().split('T')[0]) {
            diffInMinutes = (1440 - checkInMinutes) + currentTimeInMinutes;
        } else {
            diffInMinutes = currentTimeInMinutes - checkInMinutes;
        }

        if (diffInMinutes < 10) {
            return res.status(400).json({ success: false, message: `Wait ${10 - diffInMinutes} minutes before check-out` });
        }

        // PERFORM CHECK-OUT
        attendance.checkOut = timeStr;
        await attendance.save();

        res.status(200).json({
            success: true,
            message: "Check-OUT successful",
            data: {
                employee: employee.name,
                checkIn: attendance.checkIn,
                checkOut: attendance.checkOut,
                action: 'OUT'
            }
        });

    } catch (error) {
        console.error('Biometric Sync Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Register/Save fingerprint template for an employee
// @route   POST /api/v1/attendance/biometric/register
// @access  Private (Secret Key Required)
exports.registerFingerprint = async (req, res) => {
    try {
        const secretKey = req.headers['bas-secret-key'];

        const Settings = require('../models/Settings');
        const settings = await Settings.findOne({});
        const MASTER_SECRET = process.env.BIOMETRIC_SECRET || 'BAS_SECURE_TOKEN_XYZ';

        const isAuthorized = (secretKey === MASTER_SECRET) || (settings && settings.apiSecret === secretKey);

        if (!isAuthorized) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Invalid Secret Key' });
        }

        const { employeeId, template } = req.body;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        employee.fingerprintTemplate = template;
        await employee.save();

        res.status(200).json({
            success: true,
            message: `Fingerprint registered successfully for ${employee.name}`
        });

    } catch (error) {
        console.error('Biometric Registration Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
