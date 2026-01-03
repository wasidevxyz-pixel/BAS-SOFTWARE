const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Party = require('./models/Party');
const Department = require('./models/Department');
const PartyCategory = require('./models/PartyCategory');

dotenv.config({ path: './config/config.env' });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';

const analyze = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const partyCount = await Party.countDocuments();
        const partyWithCat = await Party.countDocuments({ category: { $ne: null } });
        const distinctBranches = await Party.distinct('branch');

        console.log(`Parties Total: ${partyCount}`);
        console.log(`Parties with Category: ${partyWithCat}`);
        console.log(`Distinct Party Branches:`, distinctBranches);

        const departments = await Department.find({});
        console.log(`Departments (${departments.length}):`, departments.map(d => d.name));

        const newCats = await PartyCategory.find({});
        console.log(`New PartyCategories (${newCats.length}):`, newCats.map(c => c.name));

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

analyze();
