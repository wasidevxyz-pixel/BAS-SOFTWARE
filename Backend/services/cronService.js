const cron = require('node-cron');
const Settings = require('../models/Settings');
const { createBackup, cleanOldBackups } = require('../utils/backupUtils');

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
            console.log('[AUTO-BACKUP] Running scheduled backup...');
            try {
                // Fetch fresh settings for દરેક run
                const currentSettings = await Settings.findOne({});
                if (!currentSettings || !currentSettings.autoBackupEnabled) return;

                const backupConfig = {
                    mongodbUri: currentSettings.mongodbUri || process.env.MONGO_URI || 'mongodb://localhost:27017/BAS-SOFTWARE',
                    backupFolderPath: currentSettings.backupFolderPath || './backups',
                    mongoToolsPath: currentSettings.mongoToolsPath || '',
                    type: 'auto'
                };

                const result = await createBackup(backupConfig);

                // Update metadata
                currentSettings.lastBackupDate = result.timestamp;
                await currentSettings.save();
                console.log(`[AUTO-BACKUP] ✓ Backup completed: ${result.backupFolder}`);

                // Clean old backups
                if (currentSettings.backupRetentionDays) {
                    const cleanup = await cleanOldBackups(backupConfig.backupFolderPath, currentSettings.backupRetentionDays);
                    console.log(`[AUTO-BACKUP] Cleanup: ${cleanup.message}`);
                }

            } catch (err) {
                console.error('[AUTO-BACKUP] Scheduled backup failed:', err);
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
