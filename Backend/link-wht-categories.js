const mongoose = require('mongoose');
const dotenv = require('dotenv');
const xlsx = require('xlsx');
const path = require('path');
const Supplier = require('./models/Supplier');
const PartyCategory = require('./models/PartyCategory');
const Store = require('./models/Store');

dotenv.config({ path: './.env' });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';

const linkCategories = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB.');

        // 1. Load Branches
        const stores = await Store.find({});
        const branchMap = {}; // Name -> ID
        stores.forEach(s => branchMap[s.name] = s._id);
        console.log(`Loaded ${stores.length} branches.`);

        // 2. Load WHT Categories (Global)
        const whtCats = await PartyCategory.find({ type: 'wht_supplier' });
        const catMap = {};
        whtCats.forEach(c => catMap[c.name.trim().toLowerCase()] = c._id);

        // 3. Read Excel
        const filePath = path.join(__dirname, '../export/Suppliers Dwatson (1).xlsx');
        const workbook = xlsx.readFile(filePath);

        // Stats
        let totalUpdated = 0;
        let totalNotFound = 0;
        let totalCreatedCats = 0;

        // 4. Iterate Sheets (Branches)
        for (const sheetName of workbook.SheetNames) {
            const branchId = branchMap[sheetName];
            if (!branchId) {
                console.log(`Skipping Sheet '${sheetName}': No matching Branch in DB.`);
                continue;
            }
            console.log(`Processing Branch: ${sheetName}`);

            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet);

            for (const row of data) {
                const sName = row['Supplier_Name'];
                const cName = row['Supplier_Category_Name'];

                if (!sName || !cName || cName === 'NULL') continue;

                // Find/Create Category
                let targetCatId = catMap[cName.trim().toLowerCase()];
                if (!targetCatId) {
                    try {
                        const newCat = await PartyCategory.create({
                            name: cName.trim(),
                            type: 'wht_supplier',
                            isActive: true
                        });
                        // console.log(`Created Cat: ${cName}`);
                        targetCatId = newCat._id;
                        catMap[cName.trim().toLowerCase()] = targetCatId;
                        totalCreatedCats++;
                    } catch (err) {
                        console.error(`Error creating cat ${cName}:`, err.message);
                        continue;
                    }
                }

                // Find Supplier in Branch
                const supplier = await Supplier.findOne({
                    name: sName.trim(), // Assuming Exact Match Name
                    branch: branchId
                });

                if (supplier) {
                    supplier.category = targetCatId;
                    await supplier.save();
                    totalUpdated++;
                    // process.stdout.write('.');
                } else {
                    // Try case insensitive name match as fallback?
                    const looseSupplier = await Supplier.findOne({
                        name: new RegExp(`^${sName.trim()}$`, 'i'),
                        branch: branchId
                    });
                    if (looseSupplier) {
                        looseSupplier.category = targetCatId;
                        await looseSupplier.save();
                        totalUpdated++;
                    } else {
                        // console.log(`Supplier not found: ${sName} in ${sheetName}`);
                        totalNotFound++;
                    }
                }
            }
        }

        console.log('\nMigration Complete.');
        console.log(`Total Sheets: ${workbook.SheetNames.length}`);
        console.log(`Created WHT Categories: ${totalCreatedCats}`);
        console.log(`Linked Suppliers: ${totalUpdated}`);
        console.log(`Suppliers Not Found: ${totalNotFound}`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

linkCategories();
