const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Supplier = require('./models/Supplier');
const Store = require('./models/Store');
const Category = require('./models/Category');

const EXPORT_FILE = path.join(__dirname, '../EXPORT/suppliers_export_2025-12-27T17-55-12.json');

// 1. Defined Mappings from ID -> Name (From Guide/Legacy DB)
const BRANCH_ID_MAP_LEGACY = {
    "69400d11b12b8decd2e26c4c": "(PWD-1)",
    "694011025aae0ca6bba05ba5": "(F-6)",
    "69468989dd7000a029b3177a": "(Ghouri Town)",
    "694689acdd7000a029b31784": "(Pakistan Town)",
    "694689bddd7000a029b31789": "(Gujar Khan)",
    "694689d0dd7000a029b31790": "(Chandni Chowk)",
    "69468a04dd7000a029b3179c": "(G15 Markaz)",
    "69468a14dd7000a029b317a1": "(Attock)"
};

// Keywords to help identify category if we don't know the ID
const CATEGORY_GUESS_MAP = {
    "Medicine": ["Med", "Pharma", "Drug"],
    "Cosmetics": ["Cos", "Beauty"],
    "Grocery": ["Food", "Grocery", "Bev"],
    "Homeo": ["Homeo"],
    "Under Garments": ["Garments", "Under"],
    "Sale Percentage": ["Sale"]
};

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const runImport = async () => {
    await connectDB();

    console.log(`Reading export file from: ${EXPORT_FILE}`);
    const rawData = fs.readFileSync(EXPORT_FILE, 'utf-8');
    const suppliers = JSON.parse(rawData);
    console.log(`Loaded ${suppliers.length} suppliers from file.`);

    // 1. Fetch Current Production Branches
    const currentStores = await Store.find({});
    const storeMap = {}; // Name -> ID
    currentStores.forEach(s => storeMap[s.name] = s._id);

    // 2. Fetch Current Production Categories
    const currentCategories = await Category.find({});
    const categoryMap = {}; // Name -> ID
    currentCategories.forEach(c => categoryMap[c.name] = c._id);

    console.log(`\n--- Production Data ---`);
    console.log(`Found ${currentStores.length} Stores: ${Object.keys(storeMap).join(', ')}`);
    console.log(`Found ${currentCategories.length} Categories: ${Object.keys(categoryMap).join(', ')}`);

    // 3. Analyze Categories in JSON to map Legacy ID -> Name
    const legacyCategoryIds = {};
    suppliers.forEach(s => {
        if (s.category && !legacyCategoryIds[s.category]) {
            legacyCategoryIds[s.category] = [];
        }
        if (s.category) {
            legacyCategoryIds[s.category].push(s.name);
        }
    });

    const categoryIdMapLegacy = {}; // Legacy ID -> Name
    console.log(`\n--- Mapping Categories ---`);

    for (const [id, names] of Object.entries(legacyCategoryIds)) {
        // Simple heuristic: Count keywords in first 50 names
        const sampleNames = names.slice(0, 50);
        const scores = {};

        for (const catName of Object.keys(CATEGORY_GUESS_MAP)) {
            scores[catName] = 0;
            const keywords = CATEGORY_GUESS_MAP[catName];
            for (const name of sampleNames) {
                for (const kw of keywords) {
                    if (name.toLowerCase().includes(kw.toLowerCase())) {
                        scores[catName]++;
                    }
                }
            }
        }

        // Find max score
        let bestMatch = null;
        let maxScore = 0;
        for (const [catName, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                bestMatch = catName;
            }
        }

        if (bestMatch) {
            console.log(`Legacy Category ID ${id} maps to '${bestMatch}' (Score: ${maxScore})`);
            categoryIdMapLegacy[id] = bestMatch;
        } else {
            console.warn(`WARNING: Could not identify category for ID ${id}. Sample names: ${sampleNames.slice(0, 3).join(', ')}`);
            // Fallback: If minimal, maybe assign to 'Medicine' as default or skip?
            // For now, let's list it.
        }
    }

    // 4. Prepare Operations
    const operations = [];
    const errors = [];
    const skipped = [];

    // Assuming we want to REPLACE or UPSERT based on Unique keys (Name + Branch? Or just keeping duplicates?)
    // The guide says "Deletes existing withholding suppliers" in Method 1.
    // Let's TRY to find if they exist first. Ideally use Name + Branch.

    // Better strategy:
    // Filter strictly for correct mapping.

    console.log(`\n--- Processing Suppliers ---`);

    for (const s of suppliers) {
        // Map Branch
        const branchName = BRANCH_ID_MAP_LEGACY[s.branch];
        if (!branchName) {
            errors.push(`Supplier ${s.name}: Unknown Legacy Branch ID ${s.branch}`);
            continue;
        }
        const newBranchId = storeMap[branchName];
        if (!newBranchId) {
            errors.push(`Supplier ${s.name}: Branch '${branchName}' not found in Production DB`);
            continue;
        }

        // Map Category
        let newCategoryId = null;
        if (s.category) {
            const catName = categoryIdMapLegacy[s.category];
            if (catName) {
                newCategoryId = categoryMap[catName];
            }
            if (!newCategoryId) {
                console.warn(`[WARN] Supplier "${s.name}": Category Mapping failed for ${s.category} (${catName || 'Unknown'}). Setting to null.`);
            }
        }

        // prepare object
        const newSupplier = {
            name: s.name,
            branch: newBranchId,
            category: newCategoryId,

            address: s.address,
            city: s.city,
            phoneNo: s.phoneNo,
            mobileNo: s.mobileNo,
            email: s.email,
            ntn: s.ntn,
            strn: s.strn,
            subCategory: s.subCategory,
            whtType: s.whtType,
            whtPer: s.whtPer,
            advTaxPer: s.advTaxPer,
            opening: s.opening,
            isActive: s.isActive,
            // Preserve timestamps if possible, or let new ones be created? Mongoose timestamps usually auto-create.
            // We can try to set them if needed, but 'createdAt' usually is immutable unless forced.
        };

        // Upsert by Name + Branch + WHT configs to avoid merging distinct tax entries
        // But also avoid duplicates if running multiple times
        operations.push({
            updateOne: {
                filter: {
                    name: newSupplier.name,
                    branch: newSupplier.branch,
                    whtType: newSupplier.whtType,
                    whtPer: newSupplier.whtPer
                },
                update: { $set: newSupplier },
                upsert: true
            }
        });
    }

    console.log(`Prepared ${operations.length} operations. Errors: ${errors.length}`);
    if (errors.length > 0) {
        console.log("Top 5 errors:");
        errors.slice(0, 5).forEach(e => console.log(e));
        console.log("...Aborting due to errors. check logs.");
        process.exit(1);
    }

    if (process.argv.includes('--force')) {
        console.log(`Executing Import...`);
        const result = await Supplier.bulkWrite(operations);
        console.log(`Import Complete!`, result);
    } else {
        console.log(`\n[DRY RUN] All checks passed. ${operations.length} suppliers ready to import.`);
        console.log(`Run with --force to execute.`);
    }

    process.exit(0);
};

runImport();
