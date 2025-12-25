const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
// We are in Backend dir, so .env is here
dotenv.config({ path: path.join(__dirname, '.env') });

// Load Models
const Supplier = require('./models/Supplier');
const SupplierTax = require('./models/SupplierTax');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    }
};

const deleteWasi = async () => {
    await connectDB();

    const searchTerm = 'WASI PHARMA'; // Or regex
    const regex = new RegExp(searchTerm, 'i'); // Case insensitive

    try {
        // 1. Delete Supplier(s)
        const suppliers = await Supplier.find({ name: regex });
        console.log(`Found ${suppliers.length} Supplier(s) matching '${searchTerm}'`);

        if (suppliers.length > 0) {
            for (const sup of suppliers) {
                console.log(`Deleting Supplier: ${sup.name} (${sup._id})`);
                await Supplier.deleteOne({ _id: sup._id });
            }
            console.log('Suppliers deleted.');
        } else {
            console.log('No suppliers found matching the name.');
        }

        // 2. Remove entries from SupplierTax
        const taxes = await SupplierTax.find({ "entries.supplierName": regex });
        console.log(`Found ${taxes.length} Tax Documents containing '${searchTerm}' entries.`);

        for (const doc of taxes) {
            const originalCount = doc.entries.length;

            // Filter out the entries
            const newEntries = doc.entries.filter(entry => !regex.test(entry.supplierName));

            if (newEntries.length < originalCount) {
                console.log(`Doc ${doc._id} (${doc.date}): Removing ${originalCount - newEntries.length} entries.`);

                doc.entries = newEntries;

                // Recalculate totals
                doc.totalAmount = doc.entries.reduce((acc, item) => acc + (item.invoiceAmount || 0), 0);
                doc.totalTaxDeducted = doc.entries.reduce((acc, item) => acc + (item.taxDeducted || 0), 0);
                doc.totalAiTaxAmount = doc.entries.reduce((acc, item) => acc + (item.aiTaxAmount || 0), 0);

                if (doc.entries.length === 0) {
                    console.log(`Doc ${doc._id} is now empty. Deleting document.`);
                    await SupplierTax.deleteOne({ _id: doc._id });
                } else {
                    await doc.save();
                    console.log(`Doc ${doc._id} updated.`);
                }
            }
        }

        console.log('Cleanup complete.');

    } catch (err) {
        console.error('Error during cleanup:', err);
    }

    process.exit();
};

deleteWasi();
