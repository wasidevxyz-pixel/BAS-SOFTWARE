const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
}

// Remove deprecated options
mongoose.connect(uri)
    .then(async () => {
        console.log("Connected to MongoDB for testing.");

        try {
            console.log("Attempting db.stats()...");
            const stats = await mongoose.connection.db.stats();
            console.log("✅ db.stats() successful:");
            console.log(`- storageSize: ${stats.storageSize}`);
            console.log(`- dataSize: ${stats.dataSize}`);
            console.log(`- fsTotalSize: ${stats.fsTotalSize}`);
            console.log(`- fsUsedSize: ${stats.fsUsedSize}`);
        } catch (err) {
            console.error("❌ db.stats() failed:", err.message);
        }

        try {
            console.log("\nAttempting serverStatus()...");
            const admin = mongoose.connection.db.admin();
            const serverStatus = await admin.serverStatus();
            console.log("✅ serverStatus() successful.");
        } catch (err) {
            console.error("❌ serverStatus() failed:", err.message);
        }

        mongoose.disconnect();
    })
    .catch((err) => {
        console.error("Connection failed:", err);
        process.exit(1);
    });
