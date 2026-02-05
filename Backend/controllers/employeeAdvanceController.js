const Employee = require('../models/Employee');
const EmployeeAdvance = require('../models/EmployeeAdvance');
const mongoose = require('mongoose');

// @desc    Get Advance Pay & Received Report
// @route   GET /api/v1/employee-advances/report
exports.getAdvancePayRecReport = async (req, res) => {
    try {
        const { startDate, endDate, branch, department, reportType, employee, isSummary } = req.query;

        let results = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        // 1. Get base employee list based on filters
        let empQuery = { isActive: true };
        if (employee) empQuery._id = employee;
        if (branch && branch !== 'All Branches') empQuery.branch = branch;
        if (department && department !== 'All Departments') {
            empQuery.department = new mongoose.Types.ObjectId(department);
        }

        const employees = await Employee.find(empQuery).populate('department');
        const empIds = employees.map(e => e._id);

        // 2. Calculate Opening Balances (Opening + Transactions before startDate)
        if (reportType === 'Opening Balance Only' || reportType === 'Total Advance') {
            for (const emp of employees) {
                // Initial opening from profile
                let balance = parseFloat(emp.opening || 0);

                // Add transactions before the requested startDate
                const previousAdvances = await EmployeeAdvance.find({
                    employee: emp._id,
                    date: { $lt: start }
                });

                previousAdvances.forEach(adv => {
                    if (adv.transactionType === 'Pay') balance += parseFloat(adv.paid || 0);
                    else balance -= parseFloat(adv.paid || 0);
                });

                if (balance !== 0) {
                    results.push({
                        employeeId: emp._id.toString(),
                        date: start,
                        code: emp.code,
                        name: emp.name,
                        branch: emp.branch,
                        department: emp.department ? emp.department.name : 'N/A',
                        type: 'Opening',
                        description: 'Balance B/F',
                        amount: balance,
                        transactionType: balance >= 0 ? 'Pay' : 'Received'
                    });
                }
            }
        }

        // 3. Handle Advance Transactions within the range
        if (reportType !== 'Opening Balance Only') {
            let advQuery = {
                employee: { $in: empIds },
                date: { $gte: start, $lte: end }
            };

            if (reportType === 'Advance Pay Only') advQuery.transactionType = 'Pay';
            else if (reportType === 'Advance Received Only') advQuery.transactionType = 'Received';

            const advances = await EmployeeAdvance.find(advQuery)
                .populate({
                    path: 'employee',
                    populate: { path: 'department' }
                });

            advances.forEach(adv => {
                if (!adv.employee) return;
                results.push({
                    employeeId: adv.employee._id.toString(),
                    date: adv.date,
                    code: adv.employee.code,
                    name: adv.employee.name,
                    branch: adv.employee.branch,
                    department: adv.employee.department ? adv.employee.department.name : 'N/A',
                    type: adv.transactionType === 'Pay' ? 'Advance' : 'Recovery',
                    description: adv.remarks || (adv.transactionType === 'Pay' ? 'Advance Paid' : 'Advance Recovery'),
                    amount: parseFloat(adv.paid || 0),
                    transactionType: adv.transactionType
                });
            });
        }

        // 4. Summarize if requested
        if (isSummary === 'true') {
            const summaryMap = {};
            results.forEach(row => {
                const key = row.employeeId;
                if (!summaryMap[key]) {
                    summaryMap[key] = {
                        ...row,
                        description: 'Summary Total',
                        type: 'Total',
                        amount: 0
                    };
                }
                if (row.transactionType === 'Pay' || row.type === 'Opening') summaryMap[key].amount += row.amount;
                else summaryMap[key].amount -= row.amount;
            });
            results = Object.values(summaryMap).filter(r => r.amount !== 0);
        }

        // 5. Filter out zero amounts and sort
        results = results.filter(row => row.amount !== 0);
        results.sort((a, b) => new Date(a.date) - new Date(b.date));
        res.status(200).json({ success: true, count: results.length, data: results });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all employee advances
// @route   GET /api/v1/employee-advances
exports.getEmployeeAdvances = async (req, res) => {
    try {
        let query = {};
        if (req.query.employee) {
            query.employee = req.query.employee;
        }
        if (req.query.branch) {
            query.branch = req.query.branch;
        }

        const advances = await EmployeeAdvance.find(query)
            .populate('employee')
            .populate('department')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: advances });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single employee advance
// @route   GET /api/v1/employee-advances/:id
exports.getEmployeeAdvance = async (req, res) => {
    try {
        const advance = await EmployeeAdvance.findById(req.params.id)
            .populate({
                path: 'employee',
                populate: [
                    { path: 'designation', select: 'name' },
                    { path: 'department', select: 'name' }
                ]
            })
            .populate('department')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');
        if (!advance) {
            return res.status(404).json({ success: false, message: 'Advance not found' });
        }
        res.status(200).json({ success: true, data: advance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const { recalculateEmployeeLedger } = require('./employeeLedgerController');

// @desc    Create employee advance
// @route   POST /api/v1/employee-advances
exports.createEmployeeAdvance = async (req, res) => {
    try {
        req.body.createdBy = req.user.id;
        const advance = await EmployeeAdvance.create(req.body);

        // Sync Ledger
        if (advance.employee) {
            await recalculateEmployeeLedger(advance.employee);
        }

        res.status(201).json({ success: true, data: advance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update employee advance
// @route   PUT /api/v1/employee-advances/:id
exports.updateEmployeeAdvance = async (req, res) => {
    try {
        req.body.updatedBy = req.user.id;
        const advance = await EmployeeAdvance.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!advance) {
            return res.status(404).json({ success: false, message: 'Advance not found' });
        }

        // Sync Ledger
        if (advance.employee) {
            await recalculateEmployeeLedger(advance.employee);
        }

        res.status(200).json({ success: true, data: advance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete employee advance
// @route   DELETE /api/v1/employee-advances/:id
exports.deleteEmployeeAdvance = async (req, res) => {
    try {
        const advance = await EmployeeAdvance.findByIdAndDelete(req.params.id);
        if (!advance) {
            return res.status(404).json({ success: false, message: 'Advance not found' });
        }

        // Sync Ledger
        if (advance.employee) {
            await recalculateEmployeeLedger(advance.employee);
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

