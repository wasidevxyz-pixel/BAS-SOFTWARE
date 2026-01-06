const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Store = require('./models/Store');

dotenv.config({ path: './.env' });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';

mongoose.connect(MONGO_URI).then(async () => {
    const stores = await Store.find({});
    stores.forEach(s => console.log(`'${s.name}' -> ${s._id}`));
    process.exit();
});
