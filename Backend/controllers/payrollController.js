const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const EmployeeAdvance = require('../models/EmployeeAdvance');
const EmployeePenalty = require('../models/EmployeePenalty');
const HolyDay = require('../models/HolyDay');
const Store = require('../models/Store');
const EmployeeCommission = require('../models/EmployeeCommission');
const { recalculateAdvanceBalances } = require('./employeeAdvanceController');

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
            let dailyNetHrs = 0;

            // Helper to parse HH:MM or Xh Ym or Float
            const parseToHrs = (val) => {
                if (!val) return 0;
                const str = String(val).trim();
                if (str.includes('h') || str.includes('m')) {
                    let hrs = 0;
                    const hMatch = str.match(/(\d+)h/);
                    const mMatch = str.match(/(\d+)m/);
                    if (hMatch) hrs += parseInt(hMatch[1]);
                    if (mMatch) hrs += parseInt(mMatch[1]) / 60;
                    return hrs;
                } else if (str.includes(':')) {
                    const [h, m] = str.split(':').map(Number);
                    return (h || 0) + ((m || 0) / 60);
                }
                return parseFloat(str) || 0;
            };

            // Calculate Net for this day: Worked - Break (+/-) Diff
            const gross = parseToHrs(a.workedHrs);
            const brk = parseToHrs(a.breakHrs);
            const diff = parseToHrs(a.totalDiffHrs);

            if (a.totalHrs && a.totalHrs > 0) {
                // If we have a pre-calculated total, use it
                dailyNetHrs = a.totalHrs;
            } else if (gross > 0) {
                // Fallback: calculate from parts
                dailyNetHrs = gross - brk;
                if (a.diffMode === '-') dailyNetHrs -= diff;
                else dailyNetHrs += diff;
            } else {
                dailyNetHrs = 0;
            }

            return sum + Math.max(0, dailyNetHrs);
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
                currentPayAmount -= (adv.amount || adv.paid || 0);
            }
        });

        // 1. Try picking installments from this month's records
        let planSource = [...monthlyAdvances].sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];

        // 2. Fallback: If no record this month, look at the ABSOLUTE LATEST record ANYWHERE
        // This ensures the user's latest installment plan persists until changed.
        if (!planSource) {
            planSource = await EmployeeAdvance.findOne({ employee: employeeId })
                .sort({ date: -1, createdAt: -1 });
        }

        const currentRecInstallment = planSource?.currentMonthInstallment?.installment || 0;
        const prevRecInstallment = planSource?.preMonthInstallment?.installment || 0;

        // Previous balance (Opening for this month)
        // Find the most recent advance before this month to get its balance
        const lastPrevAdvance = await EmployeeAdvance.findOne({
            employee: employeeId,
            date: { $lt: startDate }
        }).sort({ date: -1, createdAt: -1 });

        const prevAdvBalance = lastPrevAdvance ? (lastPrevAdvance.balance || 0) : (employee.opening || 0);

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
        // Rate for Basic Salary: Basic Salary / TotalWDsPer(Mon) / Duty Hours
        const totalHrsPerMonth = totalWdsPerMonth * dutyHours;
        const perDaySalary = employee.basicSalary / (totalWdsPerMonth || 30); // Keep perDaySalary for short week calc
        const perHourSalary = perDaySalary / (dutyHours || 8);

        // Rate for OT and ShortTime: Basic Salary / 30 / Duty Hours
        const otstPerHourSalary = employee.basicSalary / 30 / (dutyHours || 8);

        // Calculate OT and ShortTime based on Hours
        const diffHours = totalWorkedHours - totalHrsPerMonth;
        const overTimeHrs = diffHours > 0 ? diffHours : 0;
        const shortTimeHrs = diffHours < 0 ? Math.abs(diffHours) : 0;

        const overTimeAmount = overTimeHrs * otstPerHourSalary;
        const shortTimeAmount = shortTimeHrs * otstPerHourSalary;

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

        // Dynamic ST.LessAllow calculation: Deduct based on ShortTime hours
        const fullStLessAllow = employee.stLoss || 0;
        const stDeduction = (fullStLessAllow / 30 / (dutyHours || 8)) * shortTimeHrs;
        const calculatedStLessAllow = Math.max(0, fullStLessAllow - stDeduction);

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
            overTime: overTimeAmount,
            shortTimeHrs: shortTimeHrs,
            shortWeekDays: Math.round(shortWeeks), // Rounded to 1, 2, 3 etc.
            shortWeek: shortWeekAmount,
            shortTimeAmount: shortTimeAmount,

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

        // Cap workedHrs and workedAmount for display
        const displayWorkedHrs = totalWorkedHours > totalHrsPerMonth ? totalHrsPerMonth : totalWorkedHours;
        calculatedData.workedHrs = displayWorkedHrs;
        calculatedData.workedAmount = Math.round(displayWorkedHrs * perHourSalary);

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
            await recalculateAdvanceBalances(payroll.employee);
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
            await recalculateAdvanceBalances(payroll.employee);
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
            await recalculateAdvanceBalances(payroll.employee);
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
