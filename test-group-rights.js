const mongoose = require('mongoose');
const User = require('./Backend/models/User');
const Group = require('./Backend/models/Group');

mongoose.connect('mongodb://127.0.0.1:27017/sales-inventory')
    .then(async () => {
        console.log('Connected to MongoDB');

        try {
            // 2. Fetch User "testopt" or "testing reports"
            const users = await User.find({
                $or: [
                    { email: /testopt/i },
                    { name: /testing reports/i },
                    { email: /testing reports/i }
                ]
            }).populate('groupId');

            if (users.length === 0) {
                console.error('ERROR: User "testopt" NOT FOUND');
            } else {
                const user = users[users.length - 1]; // Get latest if multiple
                console.log('\n--- User: ' + user.name + ' ---');
                console.log('ID:', user._id);
                console.log('Email:', user.email);
                console.log('Role:', user.role);  // <--- CRITICAL CHECK
                console.log('Group ID in User:', user.groupId ? user.groupId._id : 'NULL');

                if (user.groupId) {
                    console.log('Group Name:', user.groupId.name);
                    console.log('Group IsAdmin:', user.groupId.isAdmin); // <--- CRITICAL CHECK

                    // Dump Group Rights
                    console.log('Group Rights Dump:');
                    // console.log(JSON.stringify(user.groupId.rights, null, 2));
                }

                console.log('Is Admin by Role?', user.role === 'admin');
                console.log('Is Group Admin?', user.groupId && user.groupId.isAdmin);
            }

        } catch (err) {
            console.error('Test Script Error:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => console.error('Connection Error:', err));
