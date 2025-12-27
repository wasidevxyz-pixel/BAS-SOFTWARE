const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

// Simple model for testing
const TestSchema = new mongoose.Schema({ name: String });
const TestModel = mongoose.model('TestTransaction', TestSchema);

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Mongo');

        const session = await mongoose.startSession();
        session.startTransaction();
        console.log('Transaction started');

        try {
            await TestModel.create([{ name: 'test' }], { session });
            await session.commitTransaction();
            console.log('Transaction committed successfully');
        } catch (error) {
            console.error('Transaction failed during write:', error.message);
            await session.abortTransaction();
        } finally {
            session.endSession();
        }

        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
})();
