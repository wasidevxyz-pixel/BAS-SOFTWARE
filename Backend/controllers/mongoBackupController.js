const Settings = require('../models/Settings');
const {
    createBackup,
    restoreBackup,
    getBackupsList,
    getBackupInfo,
    deleteBackup,
    cleanOldBackups
} = require('../utils/backupUtils');
// Safely import cronService
let cronService;
try {
    cronService = require('../services/cronService');
} catch (err) {
    console.warn('cronService not found, automated backups will not run.');
}

/**
 * MongoDB Backup Controller
 * Handles mongodump and mongorestore operations
 */

/**
 * @desc    Create manual MongoDB backup using mongodump
 * @route   POST /api/v1/mongodb-backup/manual
 * @access  Private/Admin
 */
exports.manualBackup = async (req, res) => {
    try {
        // Get settings
        const settings = await Settings.findOne({});

        if (!settings) {
            return res.status(400).json({
                success: false,
                message: 'Settings not found. Please configure backup settings first.'
            });
        }

        // Prepare backup configuration
        const backupConfig = {
            mongodbUri: settings.mongodbUri || process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory',
            backupFolderPath: settings.backupFolderPath || './backups',
            mongoToolsPath: settings.mongoToolsPath || ''
        };

        // Create backup
        const result = await createBackup(backupConfig);

        // Update last backup date in settings
        settings.lastBackupDate = result.timestamp;
        await settings.save();

        // Clean old backups based on retention days
        if (settings.backupRetentionDays) {
            await cleanOldBackups(backupConfig.backupFolderPath, settings.backupRetentionDays);
        }

        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                backupFolder: result.backupFolder,
                timestamp: result.timestamp
            }
        });

    } catch (error) {
        console.error('Manual backup error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Backup failed'
        });
    }
};

/**
 * @desc    Restore from MongoDB backup using mongorestore
 * @route   POST /api/v1/mongodb-backup/restore
 * @access  Private/Admin
 */
exports.restoreFromBackup = async (req, res) => {
    console.log('\n' + '='.repeat(70));
    console.log('🔄 RESTORE REQUEST RECEIVED');
    console.log('='.repeat(70));

    try {
        console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));

        const { backupFolder } = req.body;

        if (!backupFolder) {
            console.log('❌ ERROR: No backup folder provided');
            return res.status(400).json({
                success: false,
                message: 'Backup folder name is required'
            });
        }

        console.log('✓ Backup folder:', backupFolder);

        // Get settings
        console.log('📋 Fetching settings from database...');
        const settings = await Settings.findOne({});

        if (!settings) {
            console.log('❌ ERROR: Settings not found in database');
            return res.status(400).json({
                success: false,
                message: 'Settings not found. Please configure backup settings first.'
            });
        }

        console.log('✓ Settings found');
        console.log('   - mongodbUri:', settings.mongodbUri || 'NOT SET (will use .env)');
        console.log('   - backupFolderPath:', settings.backupFolderPath);
        console.log('   - mongoToolsPath:', settings.mongoToolsPath || '(using system PATH)');

        // Prepare restore configuration
        const restoreConfig = {
            mongodbUri: settings.mongodbUri || process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory',
            backupFolderPath: settings.backupFolderPath || './backups',
            mongoToolsPath: settings.mongoToolsPath || '',
            backupFolder: backupFolder
        };

        console.log('\n📝 Restore Configuration:');
        console.log('   - Target DB:', restoreConfig.mongodbUri.split('/').pop().split('?')[0]);
        console.log('   - Backup Path:', restoreConfig.backupFolderPath);
        console.log('   - Backup Folder:', restoreConfig.backupFolder);
        console.log('   - Mongo Tools:', restoreConfig.mongoToolsPath || '(system PATH)');

        console.log('\n🚀 Starting restore process...');

        // 1. SAVE CURRENT ADMIN user before restore (Safety Mechanism)
        // This ensures the user doesn't get locked out if the backup is missing the admin account
        const User = require('../models/User');
        let currentAdmin = null;
        try {
            // Get the user triggering the request (or admin@dwatson.pk as fallback)
            const userId = req.user ? req.user.id : null;
            if (userId) {
                currentAdmin = await User.findById(userId).lean();
                console.log(`[SAFETY] Preserving current admin user: ${currentAdmin ? currentAdmin.email : 'Not found'}`);
            }
        } catch (err) {
            console.warn('[SAFETY] Failed to backup current admin user:', err.message);
        }

        // 2. Perform Restore
        const result = await restoreBackup(restoreConfig);

        // 3. RESTORE ADMIN if missing (Safety Mechanism)
        if (currentAdmin) {
            try {
                const checkUser = await User.findOne({ email: currentAdmin.email });
                if (!checkUser) {
                    console.log(`[SAFETY] Admin user ${currentAdmin.email} was lost during restore. Recreating it...`);
                    // Remove _id to let Mongo generate a new one, or keep it if you want strict restoration
                    // We keep the hashed password so they can still log in!
                    const { _id, ...userData } = currentAdmin;
                    await User.create(userData);
                    console.log('[SAFETY] Admin user restored successfully.');
                } else {
                    console.log('[SAFETY] Admin user exists in backup. No action needed.');
                }
            } catch (err) {
                console.error('[SAFETY] Error restoring admin user:', err.message);
            }
        }

        console.log('\n✅ RESTORE SUCCESSFUL!');
        console.log('   - Backup:', result.backupFolder);
        console.log('   - Message:', result.message);
        console.log('='.repeat(70) + '\n');

        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                backupFolder: result.backupFolder,
                timestamp: result.timestamp
            }
        });

    } catch (error) {
        console.log('\n❌ RESTORE FAILED!');
        console.error('Error Type:', error.name);
        console.error('Error Message:', error.message);
        console.error('Stack Trace:', error.stack);
        console.log('='.repeat(70) + '\n');

        res.status(500).json({
            success: false,
            message: error.message || 'Restore failed'
        });
    }
};

/**
 * @desc    Get MongoDB backup information
 * @route   GET /api/v1/mongodb-backup/info
 * @access  Private/Admin
 */
exports.getBackupInformation = async (req, res) => {
    try {
        // Get settings
        const settings = await Settings.findOne({});

        const backupFolderPath = settings?.backupFolderPath || './backups';
        const lastBackupDate = settings?.lastBackupDate || null;

        // Get backup info
        const info = await getBackupInfo(backupFolderPath, lastBackupDate);

        res.status(200).json({
            success: true,
            data: {
                lastBackupDate: info.lastBackupDate,
                backupCount: info.backupCount,
                totalSize: info.totalSize,
                totalSizeFormatted: info.totalSizeFormatted,
                autoBackupEnabled: settings?.autoBackupEnabled || false,
                autoBackupTime: settings?.autoBackupTime || '02:00',
                backupFolderPath: backupFolderPath,
                mongoToolsPath: settings?.mongoToolsPath || ''
            }
        });

    } catch (error) {
        console.error('Get backup info error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get backup information'
        });
    }
};

/**
 * @desc    Get list of available MongoDB backups
 * @route   GET /api/v1/mongodb-backup/list
 * @access  Private/Admin
 */
exports.getAvailableBackups = async (req, res) => {
    try {
        // Get settings
        const settings = await Settings.findOne({});

        const backupFolderPath = settings?.backupFolderPath || './backups';

        // Get backups list
        const backups = await getBackupsList(backupFolderPath);

        res.status(200).json({
            success: true,
            data: backups
        });

    } catch (error) {
        console.error('Get backups list error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get backups list'
        });
    }
};

/**
 * @desc    Delete a MongoDB backup
 * @route   DELETE /api/v1/mongodb-backup/:foldername
 * @access  Private/Admin
 */
exports.deleteBackupFolder = async (req, res) => {
    try {
        const { foldername } = req.params;

        if (!foldername) {
            return res.status(400).json({
                success: false,
                message: 'Backup folder name is required'
            });
        }

        // Get settings
        const settings = await Settings.findOne({});

        const backupFolderPath = settings?.backupFolderPath || './backups';

        // Delete backup
        const result = await deleteBackup(backupFolderPath, foldername);

        res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete backup'
        });
    }
};

/**
 * @desc    Update MongoDB backup settings
 * @route   PUT /api/v1/mongodb-backup/settings
 * @access  Private/Admin
 */
exports.updateBackupSettings = async (req, res) => {
    try {
        const {
            mongodbUri,
            backupFolderPath,
            mongoToolsPath,
            autoBackupEnabled,
            autoBackupTime
        } = req.body;

        // Get settings
        let settings = await Settings.findOne({});

        if (!settings) {
            return res.status(400).json({
                success: false,
                message: 'Settings not found'
            });
        }

        // Update backup settings
        if (mongodbUri !== undefined) settings.mongodbUri = mongodbUri;
        if (backupFolderPath !== undefined) settings.backupFolderPath = backupFolderPath;
        if (mongoToolsPath !== undefined) settings.mongoToolsPath = mongoToolsPath;
        if (autoBackupEnabled !== undefined) settings.autoBackupEnabled = autoBackupEnabled;
        if (autoBackupTime !== undefined) settings.autoBackupTime = autoBackupTime;

        await settings.save();

        await settings.save();

        // Update cron schedule
        if (cronService && cronService.updateSchedule) {
            await cronService.updateSchedule();
        }

        res.status(200).json({
            success: true,
            message: 'Backup settings updated successfully',
            data: {
                mongodbUri: settings.mongodbUri,
                backupFolderPath: settings.backupFolderPath,
                mongoToolsPath: settings.mongoToolsPath,
                autoBackupEnabled: settings.autoBackupEnabled,
                autoBackupTime: settings.autoBackupTime
            }
        });

    } catch (error) {
        console.error('Update backup settings error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update backup settings'
        });
    }
};
