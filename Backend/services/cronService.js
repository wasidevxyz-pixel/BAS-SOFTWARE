const cron = require('node-cron');
const Settings = require('../models/Settings');
const { createBackup } = require('../utils/backupUtils');

let backupTask = null;

/**
 * Initialize cron jobs
 */
exports.init = async () => {
    try {
        console.log('Initializing cron services...');
        await this.startBackupJob();
    } catch (error) {
        console.error('Cron service init error:', error);
    }
};

/**
 * Start or restart the backup job based on settings
 */
exports.startBackupJob = async () => {
    try {
        // Stop existing task
        if (backupTask) {
            backupTask.stop();
            backupTask = null;
        }

        const settings = await Settings.findOne({});
        
        if (!settings || !settings.autoBackupEnabled) {
            console.log('Automated backup is disabled');
            return;
        }

        if (!settings.autoBackupTime) {
            console.log('No backup time scheduled');
            return;
        }

        // Parse time (HH:mm)
        const [hours, minutes] = settings.autoBackupTime.split(':');
        
        // Cron schedule: minute hour * * * (Daily)
        const schedule = `${minutes} ${hours} * * *`;
        
        console.log(`Scheduling automated backup for ${settings.autoBackupTime} (Daily)`);

        backupTask = cron.schedule(schedule, async () => {
            console.log('Running scheduled backup...');
            try {
                const backupConfig = {
                    mongodbUri: settings.mongodbUri || process.env.MONGO_URI || 'mongodb://localhost:27017/BAS-SOFTWARE',
                    backupFolderPath: settings.backupFolderPath || './backups',
                    mongoToolsPath: settings.mongoToolsPath || ''
                };

                await createBackup(backupConfig);
                
                // Update last run info could be good here but let's keep it simple
                // We might want to refresh settings to get latest update time
                
            } catch (err) {
                console.error('Scheduled backup failed:', err);
            }
        });

        backupTask.start();

    } catch (error) {
        console.error('Error starting backup job:', error);
    }
};

/**
 * Update the backup schedule (called when settings change)
 */
exports.updateSchedule = async () => {
    await this.startBackupJob();
};
