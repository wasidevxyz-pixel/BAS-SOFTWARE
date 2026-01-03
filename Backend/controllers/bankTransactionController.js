const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const BankTransaction = require('../models/BankTransaction');
const Bank = require('../models/Bank');
const LedgerEntry = require('../models/LedgerEntry');
const Ledger = require('../models/Ledger');

// @desc    Get all bank transactions
// @route   GET /api/v1/bank-transactions
// @access  Private (accounts access)
exports.getBankTransactions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;

  let limit = parseInt(req.query.limit);
  if (isNaN(limit)) {
    limit = 10;
  }
  // FIX: If limit is 0, we want ALL documents. Mongoose might treat limit(0) as no limit, but explicit helps.
  // Also handle skip. If limit is 0 (all), skip should probably be ignored or 0.
  if (limit === 0) {
    // Set to a very large number effectively means "All"
    limit = 10000000;
  }

  const skip = (page - 1) * limit;

  // Build query
  let query = {};

  if (req.query.bankName) {
    query.bankName = req.query.bankName;
  }

  if (req.query.branch) {
    query.branch = req.query.branch;
  }

  if (req.query.department) {
    query.department = req.query.department;
  }

  if (req.query.type) {
    query.type = req.query.type;
  }

  // Support for excluding specific refType (e.g., exclude bank_transfer from Bank Payments screen)
  if (req.query.excludeRefType && !req.query.refType) {
    query.refType = { $ne: req.query.excludeRefType };
    console.log('🔍 EXCLUDING refType:', req.query.excludeRefType);
  } else if (req.query.refType) {
    query.refType = req.query.refType;
  }

  console.log('📊 Final Query:', JSON.stringify(query, null, 2));

  if (req.query.partyId) {
    query.partyId = req.query.partyId;
  }

  if (req.query.startDate || req.query.endDate) {
    query.date = {};
    if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Cheque Date Range OR Effective Date Logic
  if (req.query.useEffectiveDate === 'true' && (req.query.startChqDate || req.query.endChqDate)) {
    // Hybrid Filter: Match if (ChequeDate in Range) OR (ChequeDate Missing AND Date in Range)
    const orConditions = [];
    const start = req.query.startChqDate ? new Date(req.query.startChqDate) : new Date(0);
    const end = req.query.endChqDate ? new Date(req.query.endChqDate) : new Date(8640000000000000);
    end.setHours(23, 59, 59, 999);

    // Condition 1: ChequeDate exists and is in range
    orConditions.push({
      chequeDate: { $gte: start, $lte: end }
    });

    // Condition 2: ChequeDate does NOT exist (null or undefined), and Date is in range
    orConditions.push({
      $and: [
        { $or: [{ chequeDate: null }, { chequeDate: { $exists: false } }] },
        { date: { $gte: start, $lte: end } }
      ]
    });

    query.$or = orConditions;

    // Clear standard date filters to avoid conflicts if they were set above
    delete query.date;
    delete query.chequeDate;

  } else if (req.query.startChqDate || req.query.endChqDate) {
    // Standard strict Cheque Date filter
    query.chequeDate = {};
    if (req.query.startChqDate) query.chequeDate.$gte = new Date(req.query.startChqDate);
    if (req.query.endChqDate) {
      const end = new Date(req.query.endChqDate);
      end.setHours(23, 59, 59, 999);
      query.chequeDate.$lte = end;
    }
  }

  // Invoice Date Range
  if (req.query.startInvDate || req.query.endInvDate) {
    query.invoiceDate = {};
    if (req.query.startInvDate) query.invoiceDate.$gte = new Date(req.query.startInvDate);
    if (req.query.endInvDate) {
      const end = new Date(req.query.endInvDate);
      end.setHours(23, 59, 59, 999);
      query.invoiceDate.$lte = end;
    }
  }

  const transactions = await BankTransaction.find(query)
    .populate('partyId', 'name email phone')
    .populate('createdBy', 'name')
    .populate('department', 'name')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  const total = await BankTransaction.countDocuments(query);

  res.status(200).json({
    success: true,
    data: transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      prev: page > 1 ? { page: page - 1 } : null,
      next: page < Math.ceil(total / limit) ? { page: page + 1 } : null
    }
  });
});

// @desc    Get single bank transaction
// @route   GET /api/v1/bank-transactions/:id
// @access  Private (accounts access)
exports.getBankTransaction = asyncHandler(async (req, res) => {
  const transaction = await BankTransaction.findById(req.params.id)
    .populate('partyId', 'name email phone address')
    .populate('createdBy', 'name');

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Bank transaction not found'
    });
  }

  res.status(200).json({
    success: true,
    data: transaction
  });
});

// @desc    Create bank transaction
// @route   POST /api/v1/bank-transactions
// @access  Private (accounts access)
// @desc    Create bank transaction
// @route   POST /api/v1/bank-transactions
// @access  Private (accounts access)
exports.createBankTransaction = asyncHandler(async (req, res) => {
  try {
    // Frontend Payload: { transactionType, chequeDate, branch, department, bank, amount, remarks, invoiceNo, invoiceDate }
    let {
      bank, // This is the ID
      transactionType,
      amount,
      remarks,
      chequeDate,
      branch,
      department,
      invoiceNo,
      invoiceDate
    } = req.body;

    // Sanitize ObjectId fields
    if (department === '') department = null;
    if (req.body.partyId === '') req.body.partyId = null;

    // 1. Resolve Bank Details to get Name
    const bankDoc = await Bank.findById(bank);
    if (!bankDoc) {
      throw new Error('Invalid Bank ID selected');
    }
    const bankName = bankDoc.bankName;
    const bankAccount = bankDoc.accountNumber || 'N/A'; // Fetch or default

    // 2. Map Fields
    // 'received' = 'deposit' (Money coming IN to bank)
    // 'paid' = 'withdrawal' (Money going OUT of bank)
    const type = (transactionType === 'received') ? 'deposit' : 'withdrawal';
    const narration = remarks || `Bank ${type} - Invoice ${invoiceNo || 'N/A'}`;
    const date = chequeDate || new Date();

    // 3. Get or create bank ledger
    const bankLedger = await Ledger.findOne({
      ledgerType: 'bank',
      ledgerName: bankName
    });

    if (!bankLedger) {
      // Create bank ledger if it doesn't exist
      const newBankLedger = new Ledger({
        ledgerName: bankName,
        ledgerType: 'bank',
        openingBalance: 0,
        balanceType: 'debit',
        currentBalance: 0,
        createdBy: req.user.id
      });
      await newBankLedger.save();
    }

    const ledger = bankLedger || await Ledger.findOne({ ledgerName: bankName });

    // 4. Create bank transaction
    // Schema expects: bankName, bankAccount, type, refType, refId, amount, narration
    const transaction = new BankTransaction({
      bankName,
      bankAccount,
      date: date,
      type,
      refType: 'manual', // Default for manual entry
      refId: new mongoose.Types.ObjectId(), // Self-reference or explicit new ID? Schema needs ObjectId. Let's create one.
      amount,
      narration,
      partyId: req.body.partyId || null, // Optional
      chequeDate, // Store extra fields if schema allows, otherwise put in narration
      invoiceNo,
      invoiceDate,
      branch,
      department,
      createdBy: req.user.id
    });

    // Note: If schema excludes branch/dept/invoices, they are lost unless we update schema.
    // Assuming for now the goal is just to SAVE successfully.

    await transaction.save();

    // 5. Create ledger entry for bank account
    const ledgerEntry = new LedgerEntry({
      ledgerId: ledger._id,
      date: transaction.date,
      debit: type === 'deposit' ? amount : 0,
      credit: type === 'withdrawal' ? amount : 0,
      narration,
      refType: `bank_${type}`,
      refId: transaction._id,
      createdBy: req.user.id
    });

    await ledgerEntry.save();

    // 6. Update bank ledger balance
    if (type === 'withdrawal') {
      ledger.currentBalance -= amount; // Paid = Credit Bank = Decrease
    } else {
      ledger.currentBalance += amount; // Received = Debit Bank = Increase
    }
    await ledger.save();

    res.status(201).json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('Bank transaction creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bank transaction creation'
    });
  }
});

// @desc    Update bank transaction
// @route   PUT /api/v1/bank-transactions/:id
// @access  Private (admin, manager)
exports.updateBankTransaction = asyncHandler(async (req, res) => {
  try {
    const transaction = await BankTransaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Bank transaction not found'
      });
    }

    const oldAmount = transaction.amount;
    const oldType = transaction.type;
    let {
      amount,
      type,
      narration,
      partyId,
      transactionType,
      remarks,
      invoiceNo,
      invoiceDate,
      chequeDate,
      branch,
      department,
      bank // Add bank to the initial destructuring
    } = req.body;

    // Sanitize ObjectId fields
    if (department === '') department = null;
    if (partyId === '') partyId = null;

    // Map frontend fields if backend native fields are missing
    if (!type && transactionType) {
      type = (transactionType === 'received') ? 'deposit' : 'withdrawal';
    }
    if (!narration && remarks) {
      narration = remarks;
    }

    // Fix: If bank ID provided (changing bank), resolve new Name/Account
    let updateFields = {
      amount,
      type,
      narration,
      partyId,
      invoiceNo,
      invoiceDate,
      chequeDate,
      branch,
      department
    };

    // If changing bank, we must update bankName and bankAccount
    if (bank) {
      const bankDoc = await Bank.findById(bank);
      if (bankDoc) {
        updateFields.bankName = bankDoc.bankName;
        updateFields.bankAccount = bankDoc.accountNumber || 'N/A';
      }
    }

    // Fix: Ensure 'date' field (used for sorting) matches chequeDate if provided
    if (chequeDate) {
      updateFields.date = chequeDate;
    }

    // Update transaction
    const updatedTransaction = await BankTransaction.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    // Update corresponding ledger entry
    const ledgerEntry = await LedgerEntry.findOne({
      refType: `bank_${oldType}`,
      refId: transaction._id
    });

    if (ledgerEntry) {
      // Reverse old entry
      const bankLedger = await Ledger.findById(ledgerEntry.ledgerId);
      if (oldType === 'withdrawal') {
        bankLedger.currentBalance -= oldAmount;
      } else {
        bankLedger.currentBalance += oldAmount;
      }

      // Apply new entry
      if (type === 'withdrawal') {
        bankLedger.currentBalance += amount;
        ledgerEntry.debit = amount;
        ledgerEntry.credit = 0;
      } else {
        bankLedger.currentBalance -= amount;
        ledgerEntry.debit = 0;
        ledgerEntry.credit = amount;
      }

      ledgerEntry.narration = narration;
      ledgerEntry.refType = `bank_${type}`;
      await ledgerEntry.save();
      await bankLedger.save();
    }

    const populatedTransaction = await BankTransaction.findById(updatedTransaction._id)
      .populate('partyId', 'name email phone')
      .populate('createdBy', 'name');

    res.status(200).json({
      success: true,
      data: populatedTransaction
    });

  } catch (error) {
    console.error('Bank transaction update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bank transaction update'
    });
  }
});

// @desc    Delete bank transaction
// @route   DELETE /api/v1/bank-transactions/:id
// @access  Private (admin only)
exports.deleteBankTransaction = asyncHandler(async (req, res) => {
  try {
    const transaction = await BankTransaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Bank transaction not found'
      });
    }

    // Update bank ledger balance
    const ledgerEntry = await LedgerEntry.findOne({
      refType: `bank_${transaction.type}`,
      refId: transaction._id
    });

    if (ledgerEntry) {
      const bankLedger = await Ledger.findById(ledgerEntry.ledgerId);

      if (bankLedger) {
        // Reverse the transaction effect
        // Withdrawal (was -) -> Now +
        // Deposit (was +) -> Now -
        if (transaction.type === 'withdrawal') {
          bankLedger.currentBalance += transaction.amount;
        } else {
          bankLedger.currentBalance -= transaction.amount;
        }
        await bankLedger.save();
      } else {
        console.warn(`Bank Transaction Delete: Ledger ${ledgerEntry.ledgerId} not found for entry ${ledgerEntry._id}`);
      }

      // Delete ledger entry
      await LedgerEntry.findByIdAndDelete(ledgerEntry._id);
    }

    // Delete transaction
    await BankTransaction.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Bank transaction deleted successfully'
    });

  } catch (error) {
    console.error('Bank transaction deletion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bank transaction deletion'
    });
  }
});

// @desc    Get bank book summary
// @route   GET /api/v1/bank-transactions/summary
// @access  Private (accounts access)
exports.getBankBookSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, bankName, branch } = req.query;

  // Build date filter
  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = new Date(startDate);
    if (endDate) dateFilter.date.$lte = new Date(endDate);
  }

  // Build bank filter
  let bankFilter = { ...dateFilter };
  if (bankName) {
    bankFilter.bankName = bankName;
  }
  if (branch) {
    bankFilter.branch = branch;
  }

  // Get bank ledgers
  const bankLedgers = await Ledger.find({ ledgerType: 'bank' });
  const bankBalances = bankLedgers.reduce((acc, ledger) => {
    acc[ledger.ledgerName] = ledger.currentBalance;
    return acc;
  }, {});

  // Get transaction summary
  const summary = await BankTransaction.aggregate([
    { $match: bankFilter },
    {
      $group: {
        _id: { bankName: '$bankName', type: '$type' },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Get daily totals
  const dailyTotals = await BankTransaction.aggregate([
    { $match: bankFilter },
    {
      $group: {
        _id: {
          bankName: '$bankName',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
        },
        deposits: {
          $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
        },
        withdrawals: {
          $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] }
        },
        net: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'deposit'] },
              '$amount',
              { $multiply: ['$amount', -1] }
            ]
          }
        }
      }
    },
    { $sort: { '_id.date': 1, '_id.bankName': 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      bankBalances,
      summary: summary.reduce((acc, item) => {
        const key = `${item._id.bankName}_${item._id.type}`;
        acc[key] = {
          totalAmount: item.totalAmount,
          count: item.count
        };
        return acc;
      }, {}),
      dailyTotals
    }
  });
});

// @desc    Get bank list
// @route   GET /api/v1/bank-transactions/banks
// @access  Private (accounts access)
exports.getBankList = asyncHandler(async (req, res) => {
  const banks = await BankTransaction.aggregate([
    {
      $group: {
        _id: '$bankName',
        totalTransactions: { $sum: 1 },
        totalDeposits: {
          $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
        },
        totalWithdrawals: {
          $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: banks
  });
});

// @desc    Bulk Verify Bank Transactions
// @route   PUT /api/v1/bank-transactions/verify
// @access  Private (Manager+)
exports.verifyBankTransactions = asyncHandler(async (req, res) => {
  console.log('--- verifyBankTransactions Hit ---');
  const { updates } = req.body; // Array of { id, isVerified }
  console.log('Updates:', JSON.stringify(updates));

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ success: false, message: 'Invalid updates payload' });
  }

  const bulkOps = updates.map(update => ({
    updateOne: {
      filter: { _id: update.id },
      update: {
        $set: {
          isVerified: update.isVerified,
          ...(update.date && { date: update.date })
        }
      }
    }
  }));

  if (bulkOps.length > 0) {
    await BankTransaction.bulkWrite(bulkOps);
  }

  res.status(200).json({ success: true, message: 'Transactions updated successfully' });
});
