const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Mongo');
        const session = await mongoose.startSession();
        session.startTransaction();
        console.log('Transaction started successfully');
        await session.abortTransaction();
        session.endSession();
        console.log('Transaction check passed');
        process.exit(0);
    } catch (err) {
        console.error('Transaction check failed:', err.message);
        process.exit(1);
    }
})();
