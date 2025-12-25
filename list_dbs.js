const mongoose = require('mongoose');

async function listDatabases() {
    try {
        const uri = 'mongodb://localhost:27017/test'; // Connect to default to list dbs
        const conn = await mongoose.createConnection(uri).asPromise();

        const admin = conn.db.admin();
        const result = await admin.listDatabases();

        console.log('--- Available Databases ---');
        result.databases.forEach(db => console.log(`- ${db.name} (Size: ${db.sizeOnDisk})`));

        await conn.close();
    } catch (err) {
        console.error('Error listing databases:', err);
    }
}

listDatabases();
