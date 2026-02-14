const mongoose = require('mongoose');
const Settings = require('./models/Settings');
require('dotenv').config();

async function checkSettings() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/BAS-SOFTWARE');
        const settings = await Settings.findOne({});
        console.log('Current Settings:', JSON.stringify(settings, null, 2));
        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

checkSettings();
