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

        // 2. Find Employee
        const employee = await Employee.findOne({ code: employeeCode });
        if (!employee) {
            return res.status(404).json({ success: false, message: `Employee with code ${employeeCode} not found` });
        }

        const logDate = new Date(timestamp || Date.now());
        const dateStr = logDate.toISOString().split('T')[0];

        // 3. Find or Create Attendance Record for the day
        let attendance = await Attendance.findOne({
            employee: employee._id,
            date: { $gte: new Date(dateStr), $lt: new Date(new Date(dateStr).setDate(new Date(dateStr).getDate() + 1)) }
        });

        const timeStr = logDate.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

        if (!attendance) {
            attendance = new Attendance({
                employee: employee._id,
                date: new Date(dateStr),
                branch: branch || employee.branch || 'Main',
                displayStatus: 'Present',
                isPresent: true
            });
        }

        // 4. Smart Toggle Logic
        let actionStatus = 'IN';
        if (!attendance.checkIn) {
            attendance.checkIn = timeStr;
            actionStatus = 'IN';
        } else {
            // Already has checkIn, so this is a Check OUT (or update to check out)
            attendance.checkOut = timeStr;
            actionStatus = 'OUT';
        }

        await attendance.save();

        res.status(200).json({
            success: true,
            message: `Attendance ${actionStatus} successful`,
            data: {
                employee: employee.name,
                checkIn: attendance.checkIn,
                checkOut: attendance.checkOut,
                action: actionStatus // Return whether it was IN or OUT
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
