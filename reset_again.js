const mongoose = require('mongoose');

async function fix() {
    console.log('Connecting...');
    await mongoose.connect('mongodb://127.0.0.1:27017/BAS-SOFTWARE');
    console.log('Connected.');

    const db = mongoose.connection.db;
    const whitems = db.collection('whitems');
    const whstocklogs = db.collection('whstocklogs');

    const item = await whitems.findOne({
        $or: [
            { itemsCode: '2000' },
            { barcode: '2000' }
        ]
    });

    if (!item) {
        process.exit();
    }

    const prevQty = (item.stock && item.stock[0]) ? item.stock[0].quantity : 0;

    await whitems.updateOne(
        { _id: item._id },
        { $set: { "stock.0.quantity": 0 } }
    );

    await whstocklogs.insertOne({
        item: item._id,
        date: new Date(),
        type: 'audit',
        qty: -prevQty,
        previousQty: prevQty,
        newQty: 0,
        refType: 'audit',
        refId: item._id,
        remarks: 'Final Clean: User deleted old vouchers after manual fix',
        createdAt: new Date(),
        updatedAt: new Date()
    });

    console.log('Stock reset to zero successfully.');
    process.exit();
}

fix();
