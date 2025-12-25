const mongoose = require('mongoose');
const Store = require('./Backend/models/Store');
const Department = require('./Backend/models/Department');
require('dotenv').config({ path: './Backend/.env' });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
    } catch (err) {
        process.exit(1);
    }
};

const check = async () => {
    await connectDB();
    const stores = await Store.find({}, 'name');
    console.log('--- STORES ---');
    stores.forEach(s => console.log(s.name));

    const depts = await Department.distinct('branch');
    console.log('--- DEPT BRANCHES ---');
    depts.forEach(b => console.log(b));
    process.exit();
};

check();
