const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('Connected to MongoDB');

    try {
        const email = 'admin@dwatson.pk';
        const password = 'admin123';

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            console.log('User not found');
            return;
        }

        console.log('User found:', user.email);
        console.log('Stored Hashed Password:', user.password);

        // Test bcrypt directly
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password Match Result:', isMatch);

        if (isMatch) {
            console.log('Login SHOULD succeed');
        } else {
            console.log('Login SHOULD fail - Password mismatch');

            // Debug: Let's see what the password hashes to
            const newSalt = await bcrypt.genSalt(10);
            const newHash = await bcrypt.hash(password, newSalt);
            console.log('New hash for comparison:', newHash);
        }

    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        mongoose.connection.close();
    }
}).catch(err => {
    console.error('Connection error:', err);
});
