const mongoose = require('mongoose');
const asyncHandler = require('../middleware/async');
const BankTransfer = require('../models/BankTransfer');
const BankTransaction = require('../models/BankTransaction');
const Bank = require('../models/Bank');
const Ledger = require('../models/Ledger');
const LedgerEntry = require('../models/LedgerEntry');

// @desc    Create bank to bank transfer
// @route   POST /api/v1/bank-transfers
// @access  Private (accounts access)
exports.createBankTransfer = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { date, fromBank, toBank, amount, remarks, branch } = req.body;

        if (!fromBank || !toBank || !amount || fromBank === toBank) {
            throw new Error('Invalid transfer details. From and To banks must be different.');
        }

        // 1. Resolve Bank Details
        const fromBankDoc = await Bank.findById(fromBank).session(session);
        const toBankDoc = await Bank.findById(toBank).session(session);

        if (!fromBankDoc || !toBankDoc) {
            throw new Error('One or both banks not found.');
        }

        // 2. Create the BankTransfer record
        const bankTransfer = new BankTransfer({
            date,
            fromBank,
            toBank,
            amount,
            remarks,
            branch,
            createdBy: req.user.id
        });

        // 3. Create Withdrawal from 'From Bank'
        const fromTransaction = new BankTransaction({
            bankName: fromBankDoc.bankName,
            bankAccount: fromBankDoc.accountNumber || 'N/A',
            date,
            type: 'withdrawal',
            refType: 'bank_transfer', // Changed from 'manual'
            refId: bankTransfer._id,
            amount,
            narration: `Bank Transfer (Out) to ${toBankDoc.bankName}. ${remarks}`,
            branch,
            createdBy: req.user.id
        });

        // 4. Create Deposit to 'To Bank'
        const toTransaction = new BankTransaction({
            bankName: toBankDoc.bankName,
            bankAccount: toBankDoc.accountNumber || 'N/A',
            date,
            type: 'deposit',
            refType: 'bank_transfer',
            refId: bankTransfer._id,
            amount,
            narration: `Bank Transfer (In) from ${fromBankDoc.bankName}. ${remarks}`,
            branch,
            createdBy: req.user.id
        });

        await fromTransaction.save({ session });
        await toTransaction.save({ session });

        bankTransfer.fromTransaction = fromTransaction._id;
        bankTransfer.toTransaction = toTransaction._id;
        await bankTransfer.save({ session });

        // 5. Update Ledgers and Create LedgerEntries
        const processLedger = async (bankName, type, amount, narration, transId) => {
            let ledger = await Ledger.findOne({ ledgerType: 'bank', ledgerName: bankName }).session(session);

            if (!ledger) {
                ledger = new Ledger({
                    ledgerName: bankName,
                    ledgerType: 'bank',
                    openingBalance: 0,
                    balanceType: 'debit',
                    currentBalance: 0,
                    createdBy: req.user.id
                });
                await ledger.save({ session });
            }

            const ledgerEntry = new LedgerEntry({
                ledgerId: ledger._id,
                date,
                debit: type === 'deposit' ? amount : 0,
                credit: type === 'withdrawal' ? amount : 0,
                narration,
                refType: `bank_${type}`,
                refId: transId,
                createdBy: req.user.id
            });
            await ledgerEntry.save({ session });

            if (type === 'withdrawal') {
                ledger.currentBalance -= amount;
            } else {
                ledger.currentBalance += amount;
            }
            await ledger.save({ session });
        };

        await processLedger(fromBankDoc.bankName, 'withdrawal', amount, fromTransaction.narration, fromTransaction._id);
        await processLedger(toBankDoc.bankName, 'deposit', amount, toTransaction.narration, toTransaction._id);

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            data: bankTransfer
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        res.status(500).json({ success: false, message: error.message });
    }
});

// @desc    Get all bank transfers
// @route   GET /api/v1/bank-transfers
// @access  Private (accounts access)
exports.getBankTransfers = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    let query = {};

    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.date.$lte = end;
        }
    }

    const transfers = await BankTransfer.find(query)
        .populate('fromBank', 'bankName')
        .populate('toBank', 'bankName')
        .sort({ date: -1 });

    res.status(200).json({
        success: true,
        data: transfers
    });
});

// @desc    Delete bank transfer
// @route   DELETE /api/v1/bank-transfers/:id
// @access  Private (admin only)
exports.deleteBankTransfer = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const transfer = await BankTransfer.findById(req.params.id).session(session);
        if (!transfer) {
            throw new Error('Transfer record not found.');
        }

        // Logic to reverse ledger entries and delete transactions
        const reverseTransaction = async (transId) => {
            const trans = await BankTransaction.findById(transId).session(session);
            if (trans) {
                const ledger = await Ledger.findOne({ ledgerType: 'bank', ledgerName: trans.bankName }).session(session);
                if (ledger) {
                    if (trans.type === 'withdrawal') {
                        ledger.currentBalance += trans.amount;
                    } else {
                        ledger.currentBalance -= trans.amount;
                    }
                    await ledger.save({ session });
                }
                await LedgerEntry.deleteOne({ refId: transId }).session(session);
                await BankTransaction.findByIdAndDelete(transId).session(session);
            }
        };

        await reverseTransaction(transfer.fromTransaction);
        await reverseTransaction(transfer.toTransaction);
        await BankTransfer.findByIdAndDelete(req.params.id).session(session);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, message: 'Transfer deleted and balances reversed.' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ success: false, message: error.message });
    }
});
