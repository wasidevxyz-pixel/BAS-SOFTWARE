const mongoose = require('mongoose');

// URI from .env
const uri = 'mongodb+srv://dwatsongroupofit_db_user:zthrtIaWZjCSwfMG@sales-managaement.ppqre0m.mongodb.net/';

async function listCloudDatabases() {
    try {
        console.log('Connecting to Cloud...');
        const conn = await mongoose.createConnection(uri).asPromise();

        const admin = conn.db.admin();
        const result = await admin.listDatabases();

        console.log('--- Cloud Databases ---');
        result.databases.forEach(db => console.log(`- ${db.name} (Size: ${db.sizeOnDisk})`));

        await conn.close();
    } catch (err) {
        console.error('Error listing cloud databases:', err);
    }
}

listCloudDatabases();
