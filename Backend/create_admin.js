const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createAdmin = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/BAS-SOFTWARE-V3';
        console.log('Connecting to:', mongoUri);

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const email = 'admin@dwatson.pk';
        const password = 'admin123s';

        let user = await User.findOne({ email });

        if (user) {
            console.log('User already exists, updating password...');
            user.password = password;
            user.isActive = true;
            user.role = 'admin';
            await user.save();
            console.log('Admin updated successfully');
        } else {
            console.log('Creating new admin user...');
            user = new User({
                name: 'System Admin',
                email: email,
                password: password,
                role: 'admin',
                isActive: true
            });
            await user.save();
            console.log('Admin created successfully');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

createAdmin();
