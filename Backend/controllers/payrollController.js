const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const EmployeeAdvance = require('../models/EmployeeAdvance');

// @desc    Get all payrolls
// @route   GET /api/v1/payrolls
exports.getPayrolls = async (req, res) => {
    try {
        const { monthYear, branch, employee } = req.query;

        let query = {};
        if (monthYear) query.monthYear = monthYear;
        if (branch) query.branch = branch;
        if (employee) query.employee = employee;

        const payrolls = await Payroll.find(query)
            .populate('employee', 'name code department designation')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: payrolls.length,
            data: payrolls
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single payroll
// @route   GET /api/v1/payrolls/:id
exports.getPayroll = async (req, res) => {
    try {
        const payroll = await Payroll.findById(req.params.id)
            .populate('employee', 'name code department designation');

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }

        res.status(200).json({ success: true, data: payroll });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Calculate payroll for employee
// @route   POST /api/v1/payrolls/calculate
exports.calculatePayroll = async (req, res) => {
    try {
        const { employeeId, monthYear, branch } = req.body;

        // Get employee details
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Get attendance for the month
        const [year, month] = monthYear.split('-');
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const attendances = await Attendance.find({
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        });

        // Calculate worked days and hours
        const workedDays = attendances.filter(a => a.isPresent).length;
        const totalWorkedHours = attendances.reduce((sum, a) => {
            if (a.workedHrs) {
                const hours = parseFloat(a.workedHrs.replace('h', '').replace('m', '/60'));
                return sum + hours;
            }
            return sum;
        }, 0);

        // Get employee advance
        const advance = await EmployeeAdvance.findOne({
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        }).sort('-date');

        // Calculate totals
        const daysInMonth = endDate.getDate();
        const perDaySalary = employee.basicSalary / daysInMonth;
        const perHourSalary = perDaySalary / 8; // Assuming 8 hours per day

        const calculatedData = {
            employee: employeeId,
            monthYear,
            branch,
            code: employee.code,
            department: employee.department,
            designation: employee.designation,
            totalDays: daysInMonth,
            workedDays: workedDays,
            workedHrs: totalWorkedHours,
            totalPerDay: perDaySalary,
            totalPerHr: perHourSalary,
            perMonth: employee.basicSalary,

            // Earnings
            teaAllowance: employee.tcAllowance || 0,
            otherAllow: employee.otherAllowance || 0,
            stLateAllow: employee.areaAllowance || 0,

            // Deductions
            securityDeposit: employee.securityDeposit || 0,
            pAAdv: advance ? advance.balance : 0,

            createdBy: req.user._id
        };

        // Calculate earnings total
        calculatedData.earningsTotal =
            (calculatedData.overTime || 0) +
            (calculatedData.rent || 0) +
            (calculatedData.natin || 0) +
            (calculatedData.monthlyComm || 0) +
            (calculatedData.teaAllowance || 0) +
            (calculatedData.stLateAllow || 0) +
            (calculatedData.otherAllow || 0);

        // Calculate deductions total
        calculatedData.deductionsTotal =
            (calculatedData.ttw || 0) +
            (calculatedData.fund || 0) +
            (calculatedData.ugrm || 0) +
            (calculatedData.securityDeposit || 0) +
            (calculatedData.penalty || 0);

        // Calculate gross and net
        calculatedData.grossTotal = calculatedData.perMonth + calculatedData.earningsTotal;
        calculatedData.netTotal = calculatedData.grossTotal - calculatedData.deductionsTotal - (calculatedData.pAAdv || 0);

        res.status(200).json({
            success: true,
            data: calculatedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create payroll
// @route   POST /api/v1/payrolls
exports.createPayroll = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;

        const payroll = await Payroll.create(req.body);

        res.status(201).json({
            success: true,
            data: payroll
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Payroll already exists for this employee and month'
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update payroll
// @route   PUT /api/v1/payrolls/:id
exports.updatePayroll = async (req, res) => {
    try {
        const payroll = await Payroll.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }

        res.status(200).json({ success: true, data: payroll });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete payroll
// @route   DELETE /api/v1/payrolls/:id
exports.deletePayroll = async (req, res) => {
    try {
        const payroll = await Payroll.findByIdAndDelete(req.params.id);

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
