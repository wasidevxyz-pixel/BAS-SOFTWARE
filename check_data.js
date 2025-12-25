const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SupplierTax = require('./Backend/models/SupplierTax');

dotenv.config({ path: './Backend/config/config.env' });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const checkData = async () => {
    await connectDB();

    console.log("Searching for 'Wasi' in SupplierTax...");

    // Find documents containing 'Wasi' in entries.supplierName
    const docs = await SupplierTax.find({
        "entries.supplierName": { $regex: "Wasi", $options: "i" }
    });

    console.log(`Found ${docs.length} documents.`);

    docs.forEach(doc => {
        console.log(`\nDoc ID: ${doc._id}, Date: ${doc.date}`);
        doc.entries.forEach(e => {
            if (e.supplierName.toLowerCase().includes('wasi')) {
                console.log(` - Entry: ${e.supplierName}, SubCat: ${e.subCategory}, Amount: ${e.invoiceAmount}`);
            }
        });
    });

    process.exit();
};

checkData();
