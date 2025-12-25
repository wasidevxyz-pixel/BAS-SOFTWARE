const Bank = require('../models/Bank');

exports.getBanks = async (req, res) => {
    try {
        const allBanks = await Bank.find();
        console.log(`Total banks in database: ${allBanks.length}`);
        console.log('All banks:', allBanks.map(b => ({ name: b.bankName, branch: b.branch, isActive: b.isActive })));

        const banks = await Bank.find({ isActive: true }).sort({ bankName: 1 });
        console.log(`Active banks: ${banks.length}`);

        res.status(200).json({ success: true, data: banks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBank = async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.id);
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        res.status(200).json({ success: true, data: bank });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.createBank = async (req, res) => {
    try {
        const Ledger = require('../models/Ledger');

        // Create the bank
        const bank = await Bank.create(req.body);

        // Automatically create a corresponding ledger account
        try {
            await Ledger.create({
                ledgerName: bank.bankName,
                ledgerType: 'bank',
                openingBalance: 0,
                currentBalance: 0,
                isActive: true
            });
            console.log(`Ledger account created for bank: ${bank.bankName}`);
        } catch (ledgerError) {
            console.error(`Failed to create ledger for bank ${bank.bankName}:`, ledgerError.message);
            // Don't fail the bank creation if ledger creation fails
        }

        res.status(201).json({ success: true, data: bank });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateBank = async (req, res) => {
    try {
        const bank = await Bank.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        res.status(200).json({ success: true, data: bank });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteBank = async (req, res) => {
    try {
        const bank = await Bank.findByIdAndDelete(req.params.id);
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createMissingBankLedgers = async (req, res) => {
    try {
        const Ledger = require('../models/Ledger');

        // Get all active banks
        const banks = await Bank.find({ isActive: true });

        // Get all existing bank ledgers
        const existingLedgers = await Ledger.find({ ledgerType: 'bank' });
        const existingLedgerNames = existingLedgers.map(l => l.ledgerName);

        // Create ledgers for banks that don't have one
        const created = [];
        const skipped = [];
        const failed = [];

        for (const bank of banks) {
            if (!existingLedgerNames.includes(bank.bankName)) {
                try {
                    await Ledger.create({
                        ledgerName: bank.bankName,
                        ledgerType: 'bank',
                        openingBalance: 0,
                        currentBalance: 0,
                        isActive: true,
                        createdBy: req.user._id  // Add the authenticated user ID
                    });
                    created.push(bank.bankName);
                } catch (error) {
                    console.error(`Failed to create ledger for ${bank.bankName}:`, error.message);
                    failed.push({ bank: bank.bankName, error: error.message });
                }
            } else {
                skipped.push(bank.bankName);
            }
        }

        res.status(200).json({
            success: true,
            message: `Created ${created.length} new bank ledgers`,
            data: { created, skipped, failed }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
