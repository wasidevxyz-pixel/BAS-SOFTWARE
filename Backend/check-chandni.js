const mongoose = require('mongoose');
const dotenv = require('dotenv');
const xlsx = require('xlsx');
const path = require('path');
const Supplier = require('./models/Supplier');
const Store = require('./models/Store');

dotenv.config({ path: './.env' });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';

const checkChandni = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const branch = await Store.findOne({ name: '(Chandni Chowk)' });
        if (!branch) {
            console.log('Branch Chandni Chowk not found!');
            process.exit();
        }

        // Check DB
        const total = await Supplier.countDocuments({ branch: branch._id });
        const withCat = await Supplier.countDocuments({ branch: branch._id, category: { $exists: true, $ne: null } });
        console.log(`DB Stats for Chandni Chowk:`);
        console.log(`Total Suppliers: ${total}`);
        console.log(`With Category: ${withCat}`);
        console.log(`Missing Category: ${total - withCat}`);

        // Check Excel
        const filePath = path.join(__dirname, '../export/Suppliers Dwatson (1).xlsx');
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets['(Chandni Chowk)'];

        if (!sheet) {
            console.log('Sheet (Chandni Chowk) not found in Excel!');
        } else {
            const data = xlsx.utils.sheet_to_json(sheet);
            console.log(`\nExcel Stats for (Chandni Chowk):`);
            console.log(`Total Rows: ${data.length}`);
            let hasCat = 0;
            let missingCat = 0;
            data.forEach(row => {
                if (row['Supplier_Category_Name'] && row['Supplier_Category_Name'] !== 'NULL') {
                    hasCat++;
                } else {
                    missingCat++;
                }
            });
            console.log(`Rows with Category: ${hasCat}`);
            console.log(`Rows missing Category: ${missingCat}`);
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkChandni();
