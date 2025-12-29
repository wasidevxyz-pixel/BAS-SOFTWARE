// Script to delete all users with "kabir" in their name
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const deleteKabirUsers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find all users with "kabir" in their name (case-insensitive)
        const usersToDelete = await User.find({
            name: { $regex: /kabir/i }
        }).select('name email');

        console.log(`\nFound ${usersToDelete.length} user(s) with "kabir" in their name:`);
        usersToDelete.forEach(user => {
            console.log(`  - ${user.name} (Login ID: ${user.email})`);
        });

        if (usersToDelete.length === 0) {
            console.log('\nNo users to delete.');
        } else {
            // Delete all users with "kabir" in their name
            const result = await User.deleteMany({
                name: { $regex: /kabir/i }
            });
            console.log(`\n✅ Successfully deleted ${result.deletedCount} user(s)`);
        }

        // Also check for users with "kabir" in email/login ID
        const usersWithKabirEmail = await User.find({
            email: { $regex: /kabir/i }
        }).select('name email');

        if (usersWithKabirEmail.length > 0) {
            console.log(`\nFound ${usersWithKabirEmail.length} user(s) with "kabir" in their Login ID:`);
            usersWithKabirEmail.forEach(user => {
                console.log(`  - ${user.name} (Login ID: ${user.email})`);
            });

            const result2 = await User.deleteMany({
                email: { $regex: /kabir/i }
            });
            console.log(`\n✅ Successfully deleted ${result2.deletedCount} additional user(s) with "kabir" in Login ID`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
        process.exit(0);
    }
};

deleteKabirUsers();
