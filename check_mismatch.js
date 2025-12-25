const mongoose = require('mongoose');
const Store = require('./Backend/models/Store');
const Department = require('./Backend/models/Department');
require('dotenv').config({ path: './Backend/.env' });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
};

const checkMismatch = async () => {
    await connectDB();

    const stores = await Store.find({});
    const storeNames = stores.map(s => s.name);
    console.log('Valid Stores:', storeNames);

    const depts = await Department.find({});
    const deptBranches = [...new Set(depts.map(d => d.branch))];
    console.log('Department Branches:', deptBranches);

    const orphaned = deptBranches.filter(b => !storeNames.includes(b));
    console.log('Orphaned Branches (No matching Store):', orphaned);

    process.exit();
};

checkMismatch();
