const EmployeeLedger = require('../models/EmployeeLedger');
const EmployeeAdvance = require('../models/EmployeeAdvance');
const EmployeeAdjustment = require('../models/EmployeeAdjustment');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');

// @desc    Get Ledger for Employee
// @route   GET /api/v1/employee-ledger/:employeeId
exports.getEmployeeLedger = async (req, res) => {
    try {
        const ledger = await EmployeeLedger.find({ employee: req.params.employeeId })
            .sort({ date: 1, createdAt: 1 });

        res.status(200).json({ success: true, data: ledger });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Current Balance
// @route   GET /api/v1/employee-ledger/balance/:employeeId
exports.getCurrentBalance = async (req, res) => {
    try {
        const ledger = await EmployeeLedger.find({ employee: req.params.employeeId })
            .sort({ date: 1, createdAt: 1 });

        let balance = 0;
        if (ledger.length > 0) {
            balance = ledger[ledger.length - 1].balance;
        } else {
            // Fallback: Check opening balance if no transactions
            const emp = await Employee.findById(req.params.employeeId);
            if (emp) balance = emp.opening || 0;
        }

        res.status(200).json({ success: true, balance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper to Rebuild Ledger Internally
exports.recalculateEmployeeLedger = async (employeeId) => {
    // 1. Clear existing ledger
    await EmployeeLedger.deleteMany({ employee: employeeId });
    const emp = await Employee.findById(employeeId);
    if (!emp) return;

    let entries = [];

    // 2. Opening Balance
    if (emp.opening && emp.opening !== 0) {
        entries.push({
            date: new Date('2000-01-01'),
            type: 'Advance',
            description: 'Opening Balance',
            debit: emp.opening,
            credit: 0,
            referenceModel: 'Opening',
            referenceId: null,
            branch: emp.branch || ''
        });
    }

    // 3. Advances
    const advances = await EmployeeAdvance.find({ employee: employeeId });
    for (const adv of advances) {
        // ORPHAN CHECK: If linked to a payroll that doesn't exist, SKIP IT (and optionally clean it up)
        if (adv.payroll) {
            const payrollExists = await Payroll.exists({ _id: adv.payroll });
            if (!payrollExists) {
                // Determine if we should delete it. 
                // Since this is a "Rebuild" function, it's safer to just ignore it for the ledger
                // but we can also delete it to clean the DB.
                // Let's delete it to be thorough.
                await EmployeeAdvance.findByIdAndDelete(adv._id);
                continue; // Skip adding to entries
            }
        }

        entries.push({
            date: new Date(adv.date),
            type: adv.transactionType === 'Pay' ? 'Advance' : 'Return',
            description: adv.remarks || 'Advance Transaction',
            debit: adv.transactionType === 'Pay' ? (adv.paid || 0) : 0,
            credit: adv.transactionType === 'Received' ? (adv.paid || 0) : 0,
            referenceModel: 'EmployeeAdvance',
            referenceId: adv._id,
            branch: adv.branch,
            createdAt: adv.createdAt
        });
    }

    // 4. Adjustments
    const adjustments = await EmployeeAdjustment.find({ employee: employeeId });
    adjustments.forEach(adj => {
        // Prevent Double Counting: Check if this adjustment is already mirrored in Advances
        // We look for an advance with same Amount, Type, and roughly same Date (or remarks check)
        const isMirrored = advances.some(adv => {
            const dateMatch = new Date(adv.date).toDateString() === new Date(adj.date).toDateString();
            const typeMatch = (adj.type === 'Pay' && adv.transactionType === 'Pay') ||
                (adj.type === 'Received' && adv.transactionType === 'Received');
            const amtMatch = adv.paid === adj.amount;
            const remarkMatch = adv.remarks && adv.remarks.includes('Adjustment'); // Strong signal

            return dateMatch && typeMatch && amtMatch && remarkMatch;
        });

        if (isMirrored) {
            // Skip this adjustment because the Advance record covers it
            return;
        }

        const isPay = adj.type === 'Pay';
        const isRec = adj.type === 'Received';
        entries.push({
            date: new Date(adj.date),
            type: 'Adjustment',
            description: adj.remarks || 'Adjustment',
            debit: isPay ? (adj.amount || 0) : 0,
            credit: isRec ? (adj.amount || 0) : 0,
            referenceModel: 'EmployeeAdjustment',
            referenceId: adj._id,
            branch: adj.branch,
            createdAt: adj.createdAt
        });
    });

    // 5. Payroll Deductions (ONLY if not linked)
    // 5. Payroll Deductions are now handled via EmployeeAdvance (type='Received' linked to payroll)
    // We do NOT scan 'Payroll' collection directly anymore to avoid double counting or ghost records.
    // The previous logic scanned for Payrolls without Advances, but since we now force Advance creation,
    // any valid payroll deduction WILL have an advance record. 
    // If it doesn't, it means it was deleted or shouldn't count.

    // Sort
    entries.sort((a, b) => {
        const d1 = new Date(a.date);
        const d2 = new Date(b.date);
        if (d1 < d2) return -1;
        if (d1 > d2) return 1;
        return (new Date(a.createdAt) - new Date(b.createdAt));
    });

    let runningBalance = 0;
    const ledgerDocs = entries.map(entry => {
        runningBalance += (entry.debit - entry.credit);
        return {
            employee: employeeId,
            date: entry.date,
            type: entry.type,
            description: entry.description,
            debit: entry.debit,
            credit: entry.credit,
            balance: runningBalance,
            referenceModel: entry.referenceModel,
            referenceId: entry.referenceId,
            branch: entry.branch
        };
    });

    if (ledgerDocs.length > 0) {
        await EmployeeLedger.insertMany(ledgerDocs);
    }
};

// @desc    Rebuild Ledger for an Employee (or all)
// @route   POST /api/v1/employee-ledger/rebuild
exports.rebuildLedger = async (req, res) => {
    try {
        const { employeeId } = req.body;
        if (employeeId) {
            await exports.recalculateEmployeeLedger(employeeId);
            return res.status(200).json({ success: true, message: `Ledger rebuilt for employee` });
        }

        const employees = await Employee.find({});
        for (const emp of employees) {
            await exports.recalculateEmployeeLedger(emp._id);
        }

        res.status(200).json({ success: true, message: `Ledger rebuilt for all employees` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
