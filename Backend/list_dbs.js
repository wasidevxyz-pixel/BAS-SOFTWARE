const mongoose = require('mongoose');
require('dotenv').config();

async function listDbs() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/BAS-SOFTWARE');
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('Databases:', JSON.stringify(dbs.databases.map(d => d.name), null, 2));
        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

listDbs();
