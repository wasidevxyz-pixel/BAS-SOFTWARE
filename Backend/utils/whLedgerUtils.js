const WHLedger = require('../models/WHLedger');
const WHCustomer = require('../models/WHCustomer');

/**
 * Update Customer Ledger and Balance
 * @param {Object} data - Ledger entry data
 * @param {string} data.customer - Customer ID
 * @param {Date} data.date - Transaction date
 * @param {string} data.description - Narration
 * @param {string} data.refType - Sale, SaleReturn, Payment
 * @param {string} data.refId - Reference Document ID
 * @param {number} data.debit - Debit amount
 * @param {number} data.credit - Credit amount
 * @param {string} data.createdBy - User ID
 */
exports.addLedgerEntry = async (data) => {
    try {
        const customer = await WHCustomer.findById(data.customer);
        if (!customer) throw new Error('Customer not found');

        // Calculate running balance: Current Balance + Debit - Credit
        const newBalance = (customer.openingBalance || 0) + (data.debit || 0) - (data.credit || 0);

        const ledgerEntry = await WHLedger.create({
            ...data,
            runningBalance: newBalance
        });

        // Update Customer Record
        customer.openingBalance = newBalance;
        await customer.save();

        return ledgerEntry;
    } catch (error) {
        console.error('Ledger Error:', error);
        throw error;
    }
};

/**
 * Delete Ledger Entry and Reverse Balance
 * @param {string} refId - Reference ID of the document being deleted
 * @param {Object} fallback - Optional data for manual reversal if ledger entry not found
 * @param {string} fallback.customer - Customer ID
 * @param {number} fallback.debit - Amount to subtract from balance
 * @param {number} fallback.credit - Amount to add to balance
 */
exports.deleteLedgerEntry = async (refId, fallback = null) => {
    try {
        const entry = await WHLedger.findOne({ refId });

        if (entry) {
            const customer = await WHCustomer.findById(entry.customer);
            if (customer) {
                // Reverse balance: New Balance = Current - AddedDebit + AddedCredit
                customer.openingBalance = (customer.openingBalance || 0) - (entry.debit || 0) + (entry.credit || 0);
                await customer.save();
                console.log(`Ledger entry found for ${refId}. Reversed customer balance.`);
            }
            await WHLedger.deleteOne({ _id: entry._id });
        } else if (fallback && fallback.customer) {
            // If No ledger entry found (old data), do manual reversal
            const customer = await WHCustomer.findById(fallback.customer);
            if (customer) {
                customer.openingBalance = (customer.openingBalance || 0) - (fallback.debit || 0) + (fallback.credit || 0);
                await customer.save();
                console.log(`No ledger entry for ${refId}. Performed manual fallback reversal.`);
            }
        }
    } catch (error) {
        console.error('Delete Ledger Error:', error);
        throw error;
    }
};
