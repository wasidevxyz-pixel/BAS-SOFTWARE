require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'tanoli' });
    user.password = '11111';
    user.isActive = true;
    user.permissions = ['right_03', 'right_27'];
    await user.save();
    console.log('Password updated to: 11111');
    console.log('Branch:', user.branch);
    console.log('GroupId:', user.groupId);
    console.log('Permissions:', user.permissions);
    await mongoose.connection.close();
    process.exit(0);
})();
