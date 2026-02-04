const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const EmployeeAdvance = require('../models/EmployeeAdvance');
const EmployeePenalty = require('../models/EmployeePenalty');
const HolyDay = require('../models/HolyDay');
const Store = require('../models/Store');
const EmployeeCommission = require('../models/EmployeeCommission');

// @desc    Get all payrolls
// @route   GET /api/v1/payrolls
exports.getPayrolls = async (req, res) => {
    try {
        const { monthYear, branch, employee } = req.query;

        let query = {};
        if (monthYear) query.monthYear = monthYear;
        if (branch && branch !== 'null' && branch !== 'undefined' && branch !== '') {
            query.branch = branch;
        }
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
        const { employeeId, monthYear, branch, thirtyWorkingDays } = req.body;

        // Get employee details with populated department and designation
        const employee = await Employee.findById(employeeId)
            .populate('department', 'name')
            .populate('designation', 'name');

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Get attendance for the month
        const [year, month] = monthYear.split('-');
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Set to end of month
        const daysInMonth = endDate.getDate();

        const attendances = await Attendance.find({
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        });

        // Calculate worked days and hours
        const workedDays = attendances.filter(a => a.isPresent).length;
        const totalWorkedHours = attendances.reduce((sum, a) => {
            if (a.workedHrs) {
                // Parse "8h 30m" format if exists, or just number
                const hrsStr = String(a.workedHrs);
                let hours = 0;
                if (hrsStr.includes('h') || hrsStr.includes('m')) {
                    const hMatch = hrsStr.match(/(\d+)h/);
                    const mMatch = hrsStr.match(/(\d+)m/);
                    if (hMatch) hours += parseInt(hMatch[1]);
                    if (mMatch) hours += parseInt(mMatch[1]) / 60;
                } else {
                    hours = parseFloat(hrsStr) || 0;
                }
                return sum + hours;
            }
            return sum;
        }, 0);

        // Get advances
        // Current month advances (Documents created in this month or for this month)
        const monthlyAdvances = await EmployeeAdvance.find({
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        });

        // Sum all 'Pay' transactions in this month
        let currentPayAmount = 0;
        monthlyAdvances.forEach(adv => {
            if (adv.transactionType === 'Pay') {
                currentPayAmount += (adv.amount || adv.paid || 0);
            } else if (adv.transactionType === 'Received') {
                // Subtract Received amounts (Adjustments/Recoveries) from the Current Month Advance total
                // This ensures CMAdv shows the NET advance impact (Advances - Cash Recoveries)
                currentPayAmount -= (adv.amount || adv.paid || 0);
            }
        });

        // Get installments from the MOST RECENTLY MODIFIED record of this month
        // Sorting by updatedAt ensures that if you change 10k to 8k, the 8k is picked up!
        const latestAdvInMonth = [...monthlyAdvances].sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];

        const currentRecInstallment = latestAdvInMonth?.currentMonthInstallment?.installment || 0;
        const prevRecInstallment = latestAdvInMonth?.preMonthInstallment?.installment || 0;

        // Previous balance (Opening for this month)
        // Find the most recent advance before this month to get its balance
        const lastPrevAdvance = await EmployeeAdvance.findOne({
            employee: employeeId,
            date: { $lt: startDate }
        }).sort({ date: -1, createdAt: -1 });

        const prevAdvBalance = lastPrevAdvance ? lastPrevAdvance.balance : (employee.opening || 0);

        // Sum all penalties for this month
        const penalties = await EmployeePenalty.find({
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        });
        const totalPenalty = penalties.reduce((sum, p) => sum + (p.penaltyAmount || 0), 0);

        // Calculate sundays and holy days in month
        let offDaysCount = 0;
        const religion = employee.religion || 'Islam';

        // Fetch active holy days for this religion in this month
        const holyDays = await HolyDay.find({
            religion: religion,
            isActive: true,
            date: { $gte: startDate, $lte: endDate }
        });

        // Convert holy day dates to a simple YYYY-MM-DD set for easy lookup
        const holidayDates = new Set(holyDays.map(hd => hd.date.toISOString().split('T')[0]));

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const isSunday = d.getDay() === 0;
            const isHoliday = holidayDates.has(dateStr);

            if (isSunday || isHoliday) {
                offDaysCount++;
            }
        }
        let totalWdsPerMonth = daysInMonth - offDaysCount;

        // Use the thirtyWorkingDays from request if provided, otherwise fall back to employee setting
        const isThirtyWorkingDays = thirtyWorkingDays !== undefined ? thirtyWorkingDays : (employee.thirtyWorkingDays || false);
        const isOTST30Days = employee.otst30WorkingDays || false;

        // If 30 working days flag is active, override the monthly total for display and calculation
        if (isThirtyWorkingDays) {
            totalWdsPerMonth = 30;
        }

        // Calculate totals based on Total Working Days
        let dutyHours = 8;
        if (employee.totalHrs && !isNaN(parseFloat(employee.totalHrs))) {
            dutyHours = parseFloat(employee.totalHrs);
        } else if (employee.fDutyTime && employee.tDutyTime) {
            try {
                const [fH, fM] = employee.fDutyTime.split(':').map(Number);
                const [tH, tM] = employee.tDutyTime.split(':').map(Number);
                let diff = (tH * 60 + tM) - (fH * 60 + fM);
                if (diff < 0) diff += 1440;
                dutyHours = diff / 60;
            } catch (e) {
                dutyHours = 8;
            }
        }
        const totalHrsPerMonth = totalWdsPerMonth * dutyHours;

        let perDaySalary = 0;
        let perHourSalary = 0;

        if (isThirtyWorkingDays) {
            // Basic Salary calculation uses 30 days
            perDaySalary = employee.basicSalary / 30;
        } else {
            // Basic Salary calculation uses actual working days of the month
            perDaySalary = employee.basicSalary / (totalWdsPerMonth || daysInMonth);
        }

        // Determine Hourly Rate for OT and Short-Time
        if (isOTST30Days) {
            // Hourly rate is fixed based on 30 days
            perHourSalary = (employee.basicSalary / 30) / (dutyHours || 8);
        } else {
            // Hourly rate is derived from the perDaySalary (which might be based on actual working days)
            perHourSalary = perDaySalary / (dutyHours || 8);
        }

        // Calculate OT and ShortTime based on Hours
        const diffHours = totalWorkedHours - totalHrsPerMonth;
        const overTimeHrs = diffHours > 0 ? diffHours : 0;
        const shortTimeHrs = diffHours < 0 ? Math.abs(diffHours) : 0;

        // Short Week Calculation: TSW = 4 - (TotalWorkedHrs / TotalHrsPerDay / 7)
        // This assumes 4 weeks in a month and calculates how many weeks were short
        const weeksWorked = totalWorkedHours / (dutyHours || 8) / 7;
        const shortWeeks = Math.max(0, 4 - weeksWorked); // Ensure non-negative

        // TSW Amount = Short Weeks * (Pay for 7 days)
        const shortWeekAmount = shortWeeks * (perDaySalary * 7);

        // Food Deduction Calculation
        // Get store's food expense per time based on employee's branch
        let foodPerTime = 0;
        let ebDeduction = 0;

        const store = await Store.findOne({ name: employee.branch });
        if (store && store.foodExpPerTime) {
            const foodExpPerTime = store.foodExpPerTime;

            // Calculate food per time based on employee's allowFood setting
            if (employee.allowFood === '1 Time Deduction') {
                foodPerTime = foodExpPerTime * 1;
            } else if (employee.allowFood === '2 Time Deduction') {
                foodPerTime = foodExpPerTime * 2;
            } else if (employee.allowFood === 'Free') {
                foodPerTime = 0;
            } else {
                // 'No Food' or any other value
                foodPerTime = 0;
            }

            // EB (Electricity Bill) = Food Per Time × Worked Days
            ebDeduction = foodPerTime * workedDays;
        }

        // Get Commissions from EmployeeCommission module
        let totalMonthlyComm = 0;
        let totalWarehouseComm = 0;
        let rotiAmount = 0;
        let rotiDays = 0;
        let nashtaAmount = 0;
        let nashtaDays = 0;

        try {
            const commissions = await EmployeeCommission.find({
                monthYear,
                branch,
                'data.id': employeeId.toString()
            });

            commissions.forEach(doc => {
                const empData = doc.data.find(d => d.id === employeeId.toString());
                if (!empData) return;

                if (doc.type === 'distribute') {
                    totalMonthlyComm += (Number(empData.otherCommission) || 0) +
                        (Number(empData.ugCommission) || 0);

                    totalWarehouseComm += (Number(empData.warehouseCommission) || 0);
                } else if (doc.type === 'employee_wise') {
                    totalMonthlyComm += (Number(empData.commission) || 0);
                } else if (doc.type === 'rotti_nashta' || doc.type === 'rotti_perks') {
                    rotiAmount += (Number(empData.rottiTotal) || 0);
                    rotiDays += (Number(empData.rottiDays) || (doc.type === 'rotti_perks' ? workedDays : 0));
                    nashtaAmount += (Number(empData.nashtaTotal) || 0);
                    nashtaDays += (Number(empData.nashtaDays) || 0);
                }
            });
        } catch (commErr) {
            console.error('Error fetching commissions:', commErr);
        }

        // Pro-rated ST.LessAllow logic
        const fullStLessAllow = employee.stLoss || 0;
        let calculatedStLessAllow = fullStLessAllow;

        if (totalWorkedHours < totalHrsPerMonth) {
            // Formula: (Full Allowance / 30 / DutyHours) * WorkedHours
            calculatedStLessAllow = (fullStLessAllow / 30 / (dutyHours || 8)) * totalWorkedHours;
        }

        const calculatedData = {
            employee: employeeId,
            monthYear,
            branch,
            code: employee.code,
            department: employee.department?.name || 'N/A',
            designation: employee.designation?.name || 'N/A',
            bank: employee.selectBank || 'N/A',
            totalDays: daysInMonth,
            totalWdsPerMonth: totalWdsPerMonth,
            totalWdsPerMonthHrs: totalHrsPerMonth,
            totalHrsPerMonth: totalHrsPerMonth,
            workedDays: workedDays,
            workedHrs: totalWorkedHours,
            totalPerDay: perDaySalary,
            totalPerHr: perHourSalary,
            perMonth: employee.basicSalary,
            offDay: employee.offDay || 'N/A',
            totalHrsPerDay: dutyHours,
            thirtyWorkingDays: isThirtyWorkingDays,
            otst30WorkingDays: isOTST30Days,
            payFullSalaryThroughBank: employee.payFullSalaryThroughBank || false,
            fullStLessAllow: fullStLessAllow,

            // Earnings
            teaAllowance: Math.round(nashtaAmount),
            nashtaDays: nashtaDays,
            otherAllow: employee.otherAllowance || 0,
            stLateAllow: Math.round(calculatedStLessAllow),
            natin: employee.fixAllowance || 0, // This is the Fix Allowance
            rent: Math.round(rotiAmount), // This is Roti
            rotiDays: rotiDays,
            monthlyComm: Math.round(totalMonthlyComm),
            warehouseComm: Math.round(totalWarehouseComm),

            // OT / ShortTime
            overTimeHrs: overTimeHrs,
            overTime: (overTimeHrs * perHourSalary),
            shortTimeHrs: shortTimeHrs,
            shortWeekDays: Math.round(shortWeeks), // Rounded to 1, 2, 3 etc.
            shortWeek: shortWeekAmount,
            shortTimeAmount: (shortTimeHrs * perHourSalary),

            // Deductions
            securityDeposit: employee.securityDeposit || 0,
            pAAdv: prevAdvBalance, // Previous Month Advance Balance
            csMale: currentPayAmount, // Current Month Advance Paid
            pmAdvRec: prevRecInstallment, // Installment from Previous Balance
            cmAdvRec: currentRecInstallment, // Installment from Current Month Balance
            penalty: totalPenalty,
            food: foodPerTime, // Food expense per time
            ebDeduction: ebDeduction, // EB (Electricity Bill) = Food × Worked Days

            createdBy: req.user._id
        };

        // Calculate earnings total
        calculatedData.earningsTotal =
            (calculatedData.overTime || 0) +
            (calculatedData.rent || 0) +
            (calculatedData.natin || 0) +
            (calculatedData.monthlyComm || 0) +
            (calculatedData.warehouseComm || 0) +
            (calculatedData.teaAllowance || 0) +
            (calculatedData.stLateAllow || 0) +
            (calculatedData.otherAllow || 0);

        // Calculate deductions total
        calculatedData.deductionsTotal =
            (calculatedData.shortTimeAmount || 0) +
            (calculatedData.ttw || 0) +
            (calculatedData.fund || 0) +
            (calculatedData.ugrm || 0) +
            (calculatedData.securityDeposit || 0) +
            (calculatedData.penalty || 0) +
            (calculatedData.ebDeduction || 0);

        // Calculate gross total: (Basic + Earnings) - ShortTime
        // This is mathematically equivalent to (WorkedHrs * HourlyRate) + Earnings
        calculatedData.grossTotal = (calculatedData.perMonth || 0) + (calculatedData.earningsTotal || 0) - (calculatedData.shortTimeAmount || 0);

        // Calculate other deductions (Fund, Security, Penalty, TSW/ShortWeek)
        const otherDeductions =
            (calculatedData.ttw || 0) +
            (calculatedData.fund || 0) +
            (calculatedData.ugrm || 0) +
            (calculatedData.securityDeposit || 0) +
            (calculatedData.penalty || 0);

        // Recovery is what actually gets deducted from net
        calculatedData.totalAdvRec = (calculatedData.pmAdvRec || 0) + (calculatedData.cmAdvRec || 0);
        // Balance info
        calculatedData.totalAdv = calculatedData.totalAdvRec;

        // NetTotal = gross total - other deductions - advances recovered
        calculatedData.netTotal = calculatedData.grossTotal - otherDeductions - (calculatedData.totalAdvRec || 0);

        // Add workedAmount for display
        calculatedData.workedAmount = Math.round(totalWorkedHours * perHourSalary);

        res.status(200).json({
            success: true,
            data: calculatedData
        });
    } catch (error) {
        console.error('Calculation Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create payroll
// @route   POST /api/v1/payrolls
const { recalculateEmployeeLedger } = require('./employeeLedgerController');

// @desc    Create payroll
// @route   POST /api/v1/payrolls
exports.createPayroll = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;

        const payroll = await Payroll.create(req.body);

        // 1. Create Linked Advance Record (For Employee Advance Screen)
        if (payroll.totalAdv > 0) {
            const remBalance = (payroll.pAAdv || 0) + (payroll.csMale || 0) - (payroll.totalAdv || 0);
            await EmployeeAdvance.create({
                employee: payroll.employee,
                date: new Date(payroll.monthYear + "-28"), // Deductions usually end of month
                branch: payroll.branch,
                transactionType: 'Received',
                code: payroll.code,
                paid: payroll.totalAdv,
                balance: remBalance,
                remarks: `Recovery from Payroll - ${payroll.monthYear}`,
                payroll: payroll._id,
                createdBy: req.user._id
            });
        }

        // 2. Sync Ledger (For Adjustment Screen)
        // Using await to ensure it completes before response
        if (payroll.employee) {
            await recalculateEmployeeLedger(payroll.employee);
        }

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

        // 1. Update/Sync Linked Advance Record
        if (payroll.totalAdv > 0) {
            const remBalance = (payroll.pAAdv || 0) + (payroll.csMale || 0) - (payroll.totalAdv || 0);
            const advData = {
                employee: payroll.employee,
                date: new Date(payroll.monthYear + "-28"),
                branch: payroll.branch,
                transactionType: 'Received',
                code: payroll.code,
                paid: payroll.totalAdv,
                balance: remBalance,
                remarks: `Recovery from Payroll - ${payroll.monthYear}`,
                payroll: payroll._id,
                updatedBy: req.user._id
            };
            // Upsert (Create if missing, Update if exists)
            await EmployeeAdvance.findOneAndUpdate({ payroll: payroll._id }, advData, { upsert: true });
        } else {
            // If totalAdv is 0, ensure no record exists
            await EmployeeAdvance.deleteMany({ payroll: payroll._id });
        }

        // 2. Sync Ledger
        if (payroll.employee) {
            await recalculateEmployeeLedger(payroll.employee);
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

        // 1. Remove linked advance record (Cleanup legacy artifact)
        await EmployeeAdvance.deleteMany({ payroll: payroll._id });

        // 2. Sync Ledger
        if (payroll.employee) {
            await recalculateEmployeeLedger(payroll.employee);
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
