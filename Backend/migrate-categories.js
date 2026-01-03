const mongoose = require('mongoose');
const dotenv = require('dotenv');
// Adjust paths based on where this script is located (root of Backend)
const Category = require('./models/Category');
const PartyCategory = require('./models/PartyCategory');

// Load environment variables
// Try valid paths
dotenv.config({ path: './config/config.env' });
dotenv.config({ path: '../.env' }); // if valid

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';

const migrate = async () => {
    try {
        console.log(`Connecting to ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        // Find Old Categories (Customer/Supplier)
        const categories = await Category.find({
            categoryType: { $in: ['customer', 'supplier'] }
        });

        console.log(`Found ${categories.length} categories to migrate.`);

        let count = 0;
        for (const cat of categories) {
            // Check if exists
            const exists = await PartyCategory.findById(cat._id);
            if (exists) {
                console.log(`Skipping ${cat.name} (Already migrated)`);
                continue;
            }

            // Create in new collection with SAME ID to preserve relationships
            await PartyCategory.create({
                _id: cat._id,
                name: cat.name,
                type: cat.categoryType,
                branch: cat.branch,
                description: cat.description,
                isActive: cat.isActive,
                createdBy: cat.createdBy,
                createdAt: cat.createdAt,
                updatedAt: cat.updatedAt
            });

            console.log(`Migrated: ${cat.name} [${cat.categoryType}]`);
            count++;
        }

        console.log(`Migration Finished. Migrated ${count} categories.`);
        process.exit();

    } catch (err) {
        console.error('Migration Error:', err);
        process.exit(1);
    }
};

migrate();
