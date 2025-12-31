const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'Backend', '.env') });

async function syncSuppliers() {
    try {
        console.log('--- STARTING SUPPLIER SYNC ---');

        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';
        console.log(`Connecting to: ${mongoUri}`);
        await mongoose.connect(mongoUri);

        const db = mongoose.connection.db;
        const suppliersCol = db.collection('suppliers');
        const storesCol = db.collection('stores');

        const LEGACY_MAP = {
            "69400d11b12b8decd2e26c4c": "(PWD-1)",
            "694011025aae0ca6bba05ba5": "(F-6)",
            "69468989dd7000a029b3177a": "(Ghouri Town)",
            "694689acdd7000a029b31784": "(Pakistan Town)",
            "694689bddd7000a029b31789": "(Gujar Khan)",
            "694689d0dd7000a029b31790": "(Chandni Chowk)",
            "69468a04dd7000a029b3179c": "(G15 Markaz)",
            "69468a14dd7000a029b317a1": "(Attock)"
        };

        const currentStores = await storesCol.find({}).toArray();
        const storeNameToId = {};
        currentStores.forEach(s => storeNameToId[s.name] = s._id);

        console.log('Clearing old supplier records...');
        await suppliersCol.deleteMany({});

        const jsonPath = path.join(__dirname, 'EXPORT', 'suppliers_export_2025-12-27T17-55-12.json');
        if (!fs.existsSync(jsonPath)) {
            console.error(`Error: JSON file not found at ${jsonPath}`);
            process.exit(1);
        }
        const jsonSuppliers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`Loaded ${jsonSuppliers.length} records from JSON.`);

        const toInsert = jsonSuppliers.map(s => {
            const branchName = LEGACY_MAP[s.branch] || 'Unknown';
            return {
                name: (s.name || '').trim(),
                branch: storeNameToId[branchName] || null,
                address: s.address || '',
                city: s.city || '',
                phoneNo: s.phoneNo || '',
                mobileNo: s.mobileNo || '',
                email: s.email || '',
                ntn: s.ntn || '',
                strn: s.strn || '',
                subCategory: s.subCategory || '',
                whtType: s.whtType || 'Monthly',
                whtPer: Number(s.whtPer || 0),
                advTaxPer: Number(s.advTaxPer || 0),
                opening: Number(s.opening || 0),
                isActive: s.isActive,
                category: null,
                createdAt: new Date(s.createdAt || Date.now()),
                updatedAt: new Date(s.updatedAt || Date.now()),
                __v: 0
            };
        });

        console.log(`Inserting 1,804 records into Database...`);
        const result = await suppliersCol.insertMany(toInsert);
        console.log(`SUCCESS! Total Inserted: ${result.insertedCount}`);

        process.exit(0);
    } catch (err) {
        console.error('FAILED:', err);
        process.exit(1);
    }
}

syncSuppliers();
