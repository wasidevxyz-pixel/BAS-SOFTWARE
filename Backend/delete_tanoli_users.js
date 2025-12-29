// Script to delete all users with "tanoli" in their name or email
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const deleteTanoliUsers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find all users with "tanoli" in their name (case-insensitive)
        const usersWithTanoliName = await User.find({
            name: { $regex: /tanoli/i }
        }).select('name email');

        console.log(`\nFound ${usersWithTanoliName.length} user(s) with "tanoli" in their name:`);
        usersWithTanoliName.forEach(user => {
            console.log(`  - ${user.name} (Login ID: ${user.email})`);
        });

        // Find all users with "tanoli" in their email/login ID (case-insensitive)
        const usersWithTanoliEmail = await User.find({
            email: { $regex: /tanoli/i }
        }).select('name email');

        console.log(`\nFound ${usersWithTanoliEmail.length} user(s) with "tanoli" in their Login ID:`);
        usersWithTanoliEmail.forEach(user => {
            console.log(`  - ${user.name} (Login ID: ${user.email})`);
        });

        // Delete all users with "tanoli" in name OR email
        const result = await User.deleteMany({
            $or: [
                { name: { $regex: /tanoli/i } },
                { email: { $regex: /tanoli/i } }
            ]
        });
        console.log(`\n✅ Successfully deleted ${result.deletedCount} user(s) with "tanoli"`);

        // Show remaining users for reference
        const remainingUsers = await User.find().select('name email').limit(10);
        console.log(`\n--- Remaining users (showing up to 10): ---`);
        remainingUsers.forEach(user => {
            console.log(`  - ${user.name} (Login ID: ${user.email})`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
        process.exit(0);
    }
};

deleteTanoliUsers();
