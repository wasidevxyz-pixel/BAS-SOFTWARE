const mongoose = require('mongoose');
const ClosingSheet = require('./models/ClosingSheet');
require('dotenv').config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/BAS-SOFTWARE');
        const start = new Date('2026-02-14T00:00:00Z');
        const end = new Date('2026-02-14T23:59:59Z');

        const totalCount = await ClosingSheet.countDocuments({
            date: { $gte: start, $lte: end }
        });
        console.log('TOTAL Closing Sheets for 2026-02-14:', totalCount);

        const branches = await ClosingSheet.find({
            date: { $gte: start, $lte: end }
        }).distinct('branch');
        console.log('Branches found:', branches);

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

checkData();
