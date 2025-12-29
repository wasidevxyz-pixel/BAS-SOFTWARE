// Script to fully fix tanoli user
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Group = require('./models/Group');

const fixTanoliUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find closing group
        const groups = await Group.find();
        console.log('\n=== Available Groups ===');
        groups.forEach(g => console.log(`  - ${g.name} (ID: ${g._id})`));

        const closingGroup = groups.find(g => g.name.toLowerCase().includes('closing'));

        // Find tanoli user
        const user = await User.findOne({ email: 'tanoli' }).select('+password');

        if (!user) {
            console.log('User "tanoli" not found');
            return;
        }

        console.log('\n=== BEFORE UPDATE ===');
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Role:', user.role);
        console.log('isActive:', user.isActive);
        console.log('groupId:', user.groupId);
        console.log('permissions:', user.permissions);
        console.log('branch:', user.branch);
        console.log('Has password:', !!user.password);

        // Update user
        user.isActive = true;
        user.branch = ['(F-6)'];
        user.password = '11';  // Will be hashed by pre-save hook

        if (closingGroup) {
            user.groupId = closingGroup._id;
            console.log('\nAssigning to group:', closingGroup.name);
        } else {
            // Use first available group
            if (groups.length > 0) {
                user.groupId = groups[0]._id;
                console.log('\nAssigning to first group:', groups[0].name);
            }
        }

        // Add basic permissions
        user.permissions = ['right_03', 'right_27'];

        await user.save();

        console.log('\n=== AFTER UPDATE ===');
        const updatedUser = await User.findOne({ email: 'tanoli' });
        console.log('Name:', updatedUser.name);
        console.log('Email:', updatedUser.email);
        console.log('isActive:', updatedUser.isActive);
        console.log('groupId:', updatedUser.groupId);
        console.log('permissions:', updatedUser.permissions);
        console.log('branch:', updatedUser.branch);
        console.log('\n✅ Password updated to: 11');
        console.log('✅ User should now be able to login');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed.');
        process.exit(0);
    }
};

fixTanoliUser();
