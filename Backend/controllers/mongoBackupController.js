const Settings = require('../models/Settings');
const {
    createBackup,
    restoreBackup,
    getBackupsList,
    getBackupInfo,
    deleteBackup,
    cleanOldBackups
} = require('../utils/backupUtils');

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
    try {
        const { backupFolder } = req.body;

        if (!backupFolder) {
            return res.status(400).json({
                success: false,
                message: 'Backup folder name is required'
            });
        }

        // Get settings
        const settings = await Settings.findOne({});

        if (!settings) {
            return res.status(400).json({
                success: false,
                message: 'Settings not found. Please configure backup settings first.'
            });
        }

        // Prepare restore configuration
        const restoreConfig = {
            mongodbUri: settings.mongodbUri || process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory',
            backupFolderPath: settings.backupFolderPath || './backups',
            mongoToolsPath: settings.mongoToolsPath || '',
            backupFolder: backupFolder
        };

        // Restore backup
        const result = await restoreBackup(restoreConfig);

        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                backupFolder: result.backupFolder,
                timestamp: result.timestamp
            }
        });

    } catch (error) {
        console.error('Restore error:', error);
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
