const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SupplierTax = require('./models/SupplierTax');
const Supplier = require('./models/Supplier');
const Category = require('./models/Category');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Connection Error:', err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    console.log('Fetching one SupplierTax record with deep population...');
    const data = await SupplierTax.findOne()
        .populate({
            path: 'entries.supplier',
            populate: {
                path: 'category',
                select: 'name'
            }
        });

    if (!data) {
        console.log('No SupplierTax data found.');
    } else {
        console.log('Found ID:', data._id);
        if (data.entries && data.entries.length > 0) {
            const ent = data.entries[0];
            // console.log('Full Supplier Object:', JSON.stringify(ent.supplier, null, 2));

            if (ent.supplier) {
                console.log('Supplier Name:', ent.supplier.name);
                console.log('Supplier Category Field (Raw):', ent.supplier.category);

                if (!ent.supplier.category) {
                    console.log('[WARN] Supplier has no category assigned!');
                    // Let's check the supplier directly to be sure it wasn't a populate fail
                    const sup = await Supplier.findById(ent.supplier._id);
                    console.log('Direct Fetch Supplier Category:', sup.category);
                } else if (typeof ent.supplier.category === 'object') {
                    console.log('Category IS Populated. Name:', ent.supplier.category.name);
                } else {
                    console.log('Category IS NOT Populated (it is an ID):', ent.supplier.category);
                }
            } else {
                console.log('Entry has no supplier!');
            }
        } else {
            console.log('Record has no entries.');
        }
    }

    // Also check simple list of suppliers to see if they generally have categories
    const someSupplier = await Supplier.findOne({ category: { $ne: null } }).populate('category');
    if (someSupplier) {
        console.log('--- Random Supplier Check ---');
        console.log('Supplier:', someSupplier.name);
        console.log('Category:', someSupplier.category);
    } else {
        console.log('--- Random Supplier Check ---');
        console.log('Could not find any supplier with a category!');
    }

    process.exit();
};

run();
