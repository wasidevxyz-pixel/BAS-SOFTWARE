const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('./models/Category');
const PartyCategory = require('./models/PartyCategory');
const Party = require('./models/Party');

// Load env
dotenv.config({ path: './config/config.env' });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';

const remap = async () => {
    try {
        console.log(`Connecting to ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        // 1. Get all parties that have a category
        const parties = await Party.find({ category: { $ne: null } });
        console.log(`Checking ${parties.length} parties for category remapping...`);

        let remapped = 0;
        let skipped = 0;

        for (const p of parties) {
            const oldCatId = p.category;

            // 2. Resolve the Old Category Name
            // We use the 'Category' model explicitly to look up the old ID
            const oldCat = await Category.findById(oldCatId);

            if (!oldCat) {
                // Sometime the ID might already be correct/new? Or just invalid.
                // Or maybe it is already a PartyCategory ID from a manual update?
                const alreadyNew = await PartyCategory.findById(oldCatId);
                if (alreadyNew) {
                    // It's already correct
                    continue;
                }
                console.log(`Party ${p.name}: Category ID ${oldCatId} not found in Old Categories.`);
                skipped++;
                continue;
            }

            // 3. Find matching New Category by Name
            // Optional: Filter by Branch if relevant? User mentioned "branch wise".
            // If PartyCategory has branch, we check it.
            let query = { name: oldCat.name };

            // Try to be specific if Old Category had branch
            // But New Category might have been created globally or for that branch?
            // Simple name match first.
            const newCat = await PartyCategory.findOne(query);

            if (newCat) {
                p.category = newCat._id;
                await p.save();
                console.log(`Remapped ${p.name}: '${oldCat.name}' (Old) -> (New ID: ${newCat._id})`);
                remapped++;
            } else {
                console.log(`Skipped ${p.name}: New category '${oldCat.name}' not found.`);

                // Optional: Auto-create if not found?
                // User said "move old category data".
                // I will auto-create if missing to be safe and helpful.
                const created = await PartyCategory.create({
                    name: oldCat.name,
                    type: 'customer', // Default, or infer?
                    branch: oldCat.branch, // Carry over branch
                    description: oldCat.description
                });
                p.category = created._id;
                await p.save();
                console.log(`  -> Auto-created New Category: '${oldCat.name}' and assigned.`);
                remapped++;
            }
        }

        console.log(`Remap Complete. Remapped: ${remapped}, Skipped: ${skipped}`);
        process.exit();

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

remap();
