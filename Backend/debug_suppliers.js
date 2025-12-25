
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: './config/config.env' });

const SupplierSchema = new mongoose.Schema({
    name: String,
    isActive: Boolean,
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    subCategory: String
}, { strict: false }); // Strict false to see all fields

const Supplier = mongoose.model('Supplier', SupplierSchema);
const StoreSchema = new mongoose.Schema({ name: String });
const Store = mongoose.model('Store', StoreSchema);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // 1. Total Count
        const count = await Supplier.countDocuments();
        console.log(`Total Suppliers in DB: ${count}`);

        // 2. Search for "Premier"
        const suppliers = await Supplier.find({
            name: { $regex: 'Premier', $options: 'i' }
        }).populate('branch');

        console.log(`\nFound ${suppliers.length} suppliers match "Premier":`);
        suppliers.forEach(s => {
            console.log('------------------------------------------------');
            console.log(`Name:        ${s.name}`);
            console.log(`SubCategory: ${s.subCategory}`);
            console.log(`ID:          ${s._id}`);
            console.log(`Active:      ${s.isActive}`);
            console.log(`Branch:      ${s.branch ? s.branch.name : 'No Branch'} (${s.branch ? s.branch._id : 'N/A'})`);
        });

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
