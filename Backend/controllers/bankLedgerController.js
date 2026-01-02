const asyncHandler = require('../middleware/async');
const Bank = require('../models/Bank');
const BankTransaction = require('../models/BankTransaction');
const DailyCash = require('../models/DailyCash');
const BankTransfer = require('../models/BankTransfer');
const Department = require('../models/Department');

// @desc    Get Bank Ledger Report with Advanced Filtering
// @route   GET /api/v1/reports/bank-ledger
// @access  Private
exports.getBankLedgerReport = asyncHandler(async (req, res) => {
    const { startDate, endDate, startInvDate, endInvDate, bankId, branch, departmentId } = req.query;

    if (!bankId) {
        return res.status(400).json({ success: false, message: 'Please select a bank' });
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const hasInvDateFilter = startInvDate || endInvDate;

    // Get the Bank
    const bank = await Bank.findById(bankId);
    if (!bank) {
        return res.status(404).json({ success: false, message: 'Bank not found' });
    }

    console.log('=== BANK LEDGER REPORT ===');
    console.log('Bank:', bank.bankName);
    console.log('Branch:', branch || 'All');
    console.log('Department:', departmentId || 'All');
    console.log('Date Range:', start.toISOString().split('T')[0], 'to', end.toISOString().split('T')[0]);
    console.log('Inv Date Filter:', hasInvDateFilter ? 'YES' : 'NO');

    const transactions = [];

    // 1. DAILY CASH ENTRIES (Type: Bank)
    // Only fetch DailyCash if NO invoice date filter is applied (as they don't have invoice dates)
    if (!hasInvDateFilter) {
        let dailyCashQuery = {
            bank: bank._id,
            mode: 'Bank',
            // Default filters
            isVerified: true,
            date: { $gte: start, $lte: end }
        };

        if (departmentId) {
            dailyCashQuery.department = departmentId;
        }

        let dailyCashEntries = await DailyCash.find(dailyCashQuery)
            .populate('department', 'name')
            .lean();

        console.log('Daily Cash (by ID) found:', dailyCashEntries.length);

        // FALLBACK: If 0 found by ID, try finding by Name (via looking up all banks with this name)
        if (dailyCashEntries.length === 0) {
            console.log('Trying fallback: Query by Bank Name');
            // Find ALL banks with this name
            const banksWithName = await Bank.find({ bankName: bank.bankName }).select('_id');
            const bankIds = banksWithName.map(b => b._id);

            // Debug: Dump raw entries for this bank ID without filters
            const rawEntries = await DailyCash.find({ bank: { $in: bankIds } }).limit(3).lean();
            console.log('RAW DEBUG (First 3 entries):', JSON.stringify(rawEntries, null, 2));

            const fallbackQuery = {
                bank: { $in: bankIds },
                mode: 'Bank',
                isVerified: true, // Only show verified (Green) entries
                date: { $gte: start, $lte: end } // Enforce date range
            };
            // Add date filter back if needed, but lets see total first
            if (departmentId) fallbackQuery.department = departmentId;

            dailyCashEntries = await DailyCash.find(fallbackQuery)
                .populate('department', 'name')
                .lean();
            console.log('Daily Cash (Unfiltered Fallback) found:', dailyCashEntries.length);
        }

        dailyCashEntries.forEach(dc => {
            const amount = dc.totalAmount || 0;
            // If verified, show "Batch Transfered" in remarks
            const remarksText = dc.isVerified ? 'Batch Transfered' : (dc.remarks || '');

            transactions.push({
                date: dc.date,
                narration: `Daily Cash`,
                remarks: remarksText,
                batchNo: dc.batchNo || '-',
                invoiceDate: null, // Daily Cash has no invoice date
                department: dc.department?.name || '-',
                type: 'Daily Cash',
                debit: amount, // Received
                credit: 0,
                sortDate: new Date(dc.date).getTime()
            });
        });
    }


    // 2. BANK TRANSACTIONS (Received & Paid)
    const bankTxnQuery = {
        bankName: bank.bankName,
        date: { $gte: start, $lte: end },
        $and: [
            { refType: { $ne: 'bank_transfer' } },
            { narration: { $not: /^Bank Transfer/i } }
        ]
    };

    if (hasInvDateFilter) {
        bankTxnQuery.invoiceDate = {};
        if (startInvDate) bankTxnQuery.invoiceDate.$gte = new Date(startInvDate);
        if (endInvDate) bankTxnQuery.invoiceDate.$lte = new Date(endInvDate);
    }

    const bankTransactions = await BankTransaction.find(bankTxnQuery)
        .populate('department', 'name')
        .lean();
    console.log('Bank Transactions found:', bankTransactions.length);

    bankTransactions.forEach(bt => {
        transactions.push({
            date: bt.date,
            narration: bt.narration || bt.remarks || 'Bank Transaction',
            remarks: bt.remarks || '',
            batchNo: bt.invoiceNo || '-',
            invoiceDate: bt.type === 'deposit' ? null : (bt.invoiceDate || null), // Only show Inv Date for Payments
            department: bt.department?.name || '-',
            type: bt.type === 'deposit' ? 'Bank Receipt' : 'Bank Payment',
            debit: bt.type === 'deposit' ? bt.amount : 0,
            credit: bt.type === 'withdrawal' ? bt.amount : 0,
            sortDate: new Date(bt.date).getTime()
        });
    });

    // 3. BANK TO BANK TRANSFERS
    const transferQuery = {
        date: { $gte: start, $lte: end },
        $or: [
            { fromBank: bank._id },
            { toBank: bank._id }
        ]
    };

    const bankTransfers = await BankTransfer.find(transferQuery)
        .populate('fromBank', 'bankName')
        .populate('toBank', 'bankName')
        .lean();

    console.log('Bank Transfers found:', bankTransfers.length);

    bankTransfers.forEach(transfer => {
        // Use optional chaining and toString() for safe ID comparison
        const fromBankId = transfer.fromBank?._id?.toString() || transfer.fromBank?.toString();
        const currentBankId = bank._id.toString();

        const isFrom = fromBankId === currentBankId;

        const otherBankName = isFrom
            ? (transfer.toBank?.bankName || 'Unknown Bank')
            : (transfer.fromBank?.bankName || 'Unknown Bank');

        transactions.push({
            date: transfer.date,
            narration: isFrom
                ? `Transfer to ${otherBankName}`
                : `Transfer from ${otherBankName}`,
            remarks: transfer.remarks || '',
            batchNo: transfer.batchNo || '-',
            invoiceDate: null,
            department: '-',
            type: 'Bank Transfer',
            debit: isFrom ? 0 : transfer.amount, // Received if TO this bank
            credit: isFrom ? transfer.amount : 0, // Paid if FROM this bank
            sortDate: new Date(transfer.date).getTime()
        });
    });

    // Calculate Opening Balance
    const openingBalance = await calculateOpeningBalance(bank, start, departmentId);

    // Sort transactions by date
    transactions.sort((a, b) => a.sortDate - b.sortDate);

    // Calculate running balance
    let runningBalance = openingBalance;
    const finalTransactions = transactions.map(tx => {
        runningBalance += tx.debit - tx.credit;
        return {
            ...tx,
            balance: runningBalance
        };
    });

    const totalDebit = transactions.reduce((sum, tx) => sum + tx.debit, 0);
    const totalCredit = transactions.reduce((sum, tx) => sum + tx.credit, 0);

    console.log('Total Transactions:', finalTransactions.length);
    console.log('Total Debit:', totalDebit);
    console.log('Total Credit:', totalCredit);
    console.log('========================');

    res.status(200).json({
        success: true,
        data: {
            bankName: bank.bankName,
            branch: bank.branch,
            openingBalance,
            transactions: finalTransactions,
            closingBalance: runningBalance,
            totalDebit,
            totalCredit
        }
    });
});

// Helper function to calculate opening balance
async function calculateOpeningBalance(bank, startDate, departmentId) {
    let balance = 0;

    // Daily Cash before start date
    const dcQuery = {
        bank: bank._id,
        mode: 'Bank',
        isVerified: true,
        date: { $lt: startDate }
    };
    if (departmentId) dcQuery.department = departmentId;

    const dcHistory = await DailyCash.aggregate([
        { $match: dcQuery },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    balance += dcHistory[0]?.total || 0;

    // Bank Transactions before start date
    const btHistory = await BankTransaction.aggregate([
        {
            $match: {
                bankName: bank.bankName,
                date: { $lt: startDate },
                $and: [
                    { refType: { $ne: 'bank_transfer' } },
                    { narration: { $not: /^Bank Transfer/i } }
                ]
            }
        },
        {
            $group: {
                _id: null,
                deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
                withdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } }
            }
        }
    ]);

    balance += (btHistory[0]?.deposits || 0) - (btHistory[0]?.withdrawals || 0);

    // Bank Transfers before start date
    const transfersFrom = await BankTransfer.aggregate([
        { $match: { fromBank: bank._id, date: { $lt: startDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const transfersTo = await BankTransfer.aggregate([
        { $match: { toBank: bank._id, date: { $lt: startDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    balance -= transfersFrom[0]?.total || 0;
    balance += transfersTo[0]?.total || 0;

    return balance;
}

// @desc    Get Aggregate Bank Balance for all banks in a Branch as of a specific date
// @route   GET /api/v1/reports/bank-ledger/branch-balance
// @access  Private
exports.getBranchBankBalance = asyncHandler(async (req, res) => {
    const { branch, date } = req.query;

    if (!branch || !date) {
        return res.status(400).json({ success: false, message: 'Please provide branch and date' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999);

    // Get all banks for the branch
    const banks = await Bank.find({ branch: branch });

    if (!banks || banks.length === 0) {
        return res.status(200).json({ success: true, totalBalance: 0, message: 'No banks found' });
    }

    let totalBalance = 0;

    // Calculate closing balance for each bank
    // We reuse calculateOpeningBalance by passing the NEXT day's start, 
    // which effectively gives us the closing balance of the target date.
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    for (const bank of banks) {
        const bankBal = await calculateOpeningBalance(bank, nextDay);
        totalBalance += bankBal;
    }

    res.status(200).json({
        success: true,
        totalBalance,
        bankCount: banks.length
    });
});

// @desc    Get Individual Bank Balances for all banks in a Branch as of a specific date
// @route   GET /api/v1/reports/bank-ledger/branch-bank-balances
// @access  Private
exports.getBranchBankBalances = asyncHandler(async (req, res) => {
    const { branch, date } = req.query;

    if (!branch || !date) {
        return res.status(400).json({ success: false, message: 'Please provide branch and date' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999);

    // Get all banks for the branch - EXCLUDE Branch Bank type
    const banks = await Bank.find({
        branch: branch,
        bankType: { $ne: 'Branch Bank' } // Exclude Branch Bank type
    }).populate('department', 'name');

    if (!banks || banks.length === 0) {
        return res.status(200).json({ success: true, banks: [], totalBalance: 0, message: 'No banks found' });
    }

    // Calculate closing balance for each bank
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const bankBalances = [];
    let totalBalance = 0;

    for (const bank of banks) {
        const bankBal = await calculateOpeningBalance(bank, nextDay);
        totalBalance += bankBal;

        // Get department abbreviation from the bank's department
        const deptName = bank.department?.name || '';
        const deptAbbr = deptName.substring(0, 3).toUpperCase();

        // Check if bank name already contains department abbreviation to avoid duplicates
        // e.g., "ALF (MED)" already has "(MED)" so don't add it again
        let displayName = bank.bankName;
        if (deptAbbr && !bank.bankName.includes(`(${deptAbbr})`)) {
            displayName = `${bank.bankName} (${deptAbbr})`;
        }

        bankBalances.push({
            bankId: bank._id,
            bankName: bank.bankName,
            bankType: bank.bankType,
            department: deptName,
            deptAbbr: deptAbbr,
            displayName: displayName,
            balance: bankBal
        });
    }

    res.status(200).json({
        success: true,
        banks: bankBalances,
        totalBalance,
        bankCount: banks.length
    });
});

// @desc    Get Opening Balance for Bank Summary (multiple banks)
// @route   GET /api/v1/reports/bank-ledger/summary-opening-balance
// @access  Private
// Uses same formula approach as Zakat - aggregate all transactions before startDate
exports.getSummaryOpeningBalance = asyncHandler(async (req, res) => {
    const { startDate, branch, bankIds } = req.query;

    if (!startDate) {
        return res.status(400).json({ success: false, message: 'Please provide startDate' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    // Determine target Bank IDs and Names
    let targetBankIds = [];
    let targetBankNames = [];

    if (bankIds) {
        targetBankIds = bankIds.split(',');
    } else if (branch) {
        // If no specific banks selected but branch is, get all banks for this branch
        const banks = await Bank.find({ branch }).select('_id bankName');
        targetBankIds = banks.map(b => b._id.toString());
        targetBankNames = banks.map(b => b.bankName);
    } else {
        // Fallback: If no branch/bank filter (rare for summary), might be hazardous. 
        // But let's assume filtering by at least branch is standard. 
        // If strictly required, we'd fetch ALL banks.
    }

    // Populate names if we only had IDs (for BankTransaction/Transfer string matching)
    if (targetBankIds.length > 0 && targetBankNames.length === 0) {
        const banks = await Bank.find({ _id: { $in: targetBankIds } }).select('bankName');
        targetBankNames = banks.map(b => b.bankName);
    }

    // 1. Daily Cash (Batch Transfers) - BEFORE Start Date
    const dcMatchFilter = {
        mode: 'Bank',
        bank: { $in: targetBankIds },
        date: { $lt: start }
    };
    // Include unverified as per user request (no isVerified: true check)

    const dcEntries = await DailyCash.find(dcMatchFilter).lean();
    let dcTotal = 0;
    dcEntries.forEach(item => {
        const ratePerc = item.deductedAmount || 0;
        const grossBase = (item.totalAmount || 0) + ratePerc;
        const deduction = (grossBase * ratePerc) / 100;
        const netAmount = Math.round(grossBase - deduction);
        dcTotal += netAmount;
    });

    // 2. Bank Transactions (Withdrawals/Deposits) - BEFORE Start Date
    // Exclude 'bank_transfer' types as they are handled in step 3
    const btQuery = {
        date: { $lt: start },
        $or: [
            { bank: { $in: targetBankIds } },
            { bankName: { $in: targetBankNames } }
        ],
        $and: [
            { refType: { $ne: 'bank_transfer' } },
            { narration: { $not: /^Bank Transfer/i } } // Legacy check
        ]
    };

    const btEntries = await BankTransaction.find(btQuery).select('amount type transactionType').lean();

    let btTotal = 0;
    btEntries.forEach(bt => {
        const type = (bt.transactionType || bt.type || '').toLowerCase();
        if (type === 'deposit' || type === 'received') {
            btTotal += bt.amount || 0;
        } else {
            // Withdrawal / Paid
            btTotal -= bt.amount || 0;
        }
    });

    // 3. Bank Transfers - BEFORE Start Date
    // If we are the 'fromBank', it's a withdrawal (-). If 'toBank', it's a deposit (+).
    // We only care if the OTHER side is NOT in our selected list? 
    // No, if transfer is From Bank A to Bank B, and both are selected:
    // Bank A: -100, Bank B: +100. Net change 0. Correct.
    // If only Bank A selected: -100. Correct.

    const btbFrom = await BankTransfer.aggregate([
        { $match: { fromBank: { $in: targetBankIds }, date: { $lt: start } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const btbTo = await BankTransfer.aggregate([
        { $match: { toBank: { $in: targetBankIds }, date: { $lt: start } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalFrom = btbFrom[0]?.total || 0;
    const totalTo = btbTo[0]?.total || 0;
    const btbTotal = totalTo - totalFrom;

    // Final Aggregation
    const openingBalance = dcTotal + btTotal + btbTotal;

    res.status(200).json({
        success: true,
        openingBalance: openingBalance,
        debug: {
            dc: dcTotal,
            bt: btTotal,
            btb: btbTotal
        }
    });
});

// Helper function to calculate opening balance - defined above at line 226
