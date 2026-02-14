const mongoose = require('mongoose');
const WHItem = require('./Backend/models/WHItem');
const WHStockLog = require('./Backend/models/WHStockLog');

async function checkStock() {
    try {
        await mongoose.connect('mongodb://localhost:27017/sales-inventory');
        console.log('Connected to DB');

        const item = await WHItem.findOne({ itemsCode: '2000' });
        if (!item) {
            console.log('Item 2000 not found');
            return;
        }

        console.log('Item Found:', item.name);
        console.log('Current Stock Array:', JSON.stringify(item.stock, null, 2));

        const logs = await WHStockLog.find({ item: item._id }).sort({ createdAt: -1 }).limit(10);
        console.log('Recent Logs:', JSON.stringify(logs, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkStock();
