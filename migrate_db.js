const mongoose = require('mongoose');

// OLD Cloud URI (Source)
const sourceUri = 'mongodb+srv://dwatsongroupofit_db_user:zthrtIaWZjCSwfMG@sales-managaement.ppqre0m.mongodb.net/test';

// NEW Local URI (Target)
const targetUri = 'mongodb://localhost:27017/BAS-SOFTWARE';

async function copyDatabase() {
    try {
        // 1. Connect to Source
        console.log(`Connecting to Source Cloud DB...`);
        const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
        console.log('Connected to Source.');

        // 2. Connect to Target
        console.log(`Connecting to Target Local DB...`);
        const targetConn = await mongoose.createConnection(targetUri).asPromise();
        console.log('Connected to Target.');

        // 3. Get all collections
        const collections = await sourceConn.db.listCollections().toArray();

        for (const collectionInfo of collections) {
            const collName = collectionInfo.name;
            if (collName.startsWith('system.')) continue;

            console.log(`Processing collection: ${collName}`);

            const sourceColl = sourceConn.db.collection(collName);
            const docs = await sourceColl.find({}).toArray();

            if (docs.length > 0) {
                const targetColl = targetConn.db.collection(collName);

                // Use bulkWrite for better handling of IDs
                // Mapping docs to insert operations
                const ops = docs.map(doc => ({
                    insertOne: { document: doc }
                }));

                try {
                    await targetColl.bulkWrite(ops, { ordered: false });
                    console.log(`  -> Copied ${docs.length} documents.`);
                } catch (e) {
                    console.log(`  -> Copied with some duplicates/errors (usually safe to ignore if re-running). Count: ${e.result?.nInserted || 0}`);
                }
            } else {
                console.log(`  -> Empty collection.`);
            }
        }

        console.log('Migration Completed.');
        await sourceConn.close();
        await targetConn.close();
        process.exit(0);

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

copyDatabase();
