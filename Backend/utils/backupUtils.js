const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Backup Utilities Module
 * Handles MongoDB backup and restore operations using mongodump and mongorestore
 */

/**
 * Create a backup of the MongoDB database
 * @param {Object} config - Backup configuration
 * @param {string} config.mongodbUri - MongoDB connection URI
 * @param {string} config.backupFolderPath - Base path for backups
 * @param {string} config.mongoToolsPath - Path to MongoDB tools (optional)
 * @param {string} config.type - Type of backup ('auto' or 'manual')
 * @returns {Promise<Object>} Backup result with folder name and timestamp
 */
async function createBackup(config) {
    try {
        const { mongodbUri, backupFolderPath, mongoToolsPath, type = 'manual' } = config;

        let backupFolder;

        if (type === 'auto') {
            // For auto backups, use a date-based name to prevent duplicates (One per day)
            // Using UTC date ensures consistency across server restarts/timezones
            const datePart = new Date().toISOString().split('T')[0];
            backupFolder = `backup-auto-${datePart}`;

            // Check if this daily backup already exists
            const checkPath = path.join(backupFolderPath, backupFolder);
            try {
                await fs.access(checkPath);
                // If we get here, directory exists.
                // Check if it's a "successful" backup (has info file)
                try {
                    await fs.access(path.join(checkPath, 'backup-info.json'));
                    console.log(`[BACKUP] Auto backup for today (${backupFolder}) already exists. Skipping.`);
                    return {
                        success: true,
                        backupFolder,
                        fullPath: checkPath,
                        timestamp: new Date(), // Just current time
                        message: 'Daily backup already exists'
                    };
                } catch (e) {
                    // Directory exists but no info file? might be partial/failed. 
                    // We will proceed to overwrite/resume.
                    console.log(`[BACKUP] Found partial auto backup folders, overwriting...`);
                }
            } catch (err) {
                // Directory does not exist, proceed.
            }
        } else {
            // Manual: Keep precise timestamp with milliseconds
            const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
            backupFolder = `backup-${timestamp}`;
        }

        const fullBackupPath = path.join(backupFolderPath, backupFolder);

        // Ensure backup directory exists
        await fs.mkdir(backupFolderPath, { recursive: true });

        // Build mongodump command
        const mongodumpCmd = mongoToolsPath
            ? path.join(mongoToolsPath, 'mongodump')
            : 'mongodump';

        const command = `"${mongodumpCmd}" --uri="${mongodbUri}" --out="${fullBackupPath}"`;

        console.log(`[BACKUP] Starting separate backup: ${backupFolder} (Type: ${type})`);
        console.log(`[BACKUP] Command: ${command.replace(mongodbUri, 'HIDDEN_URI')}`);

        // Execute mongodump
        const { stdout, stderr } = await execPromise(command, {
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        if (stderr && !stderr.includes('done dumping')) {
            console.error(`[BACKUP] Warning: ${stderr}`);
        }

        // Save metadata
        const metadata = {
            type,
            timestamp: new Date(),
            folder: backupFolder
        };
        await fs.writeFile(path.join(fullBackupPath, 'backup-info.json'), JSON.stringify(metadata, null, 2));

        console.log(`[BACKUP] Success: ${backupFolder}`);

        return {
            success: true,
            backupFolder,
            fullPath: fullBackupPath,
            timestamp: new Date(),
            message: 'Backup created successfully'
        };

    } catch (error) {
        console.error('[BACKUP] Error:', error.message);
        throw new Error(`Backup failed: ${error.message}`);
    }
}

/**
 * Restore database from a backup folder
 * @param {Object} config - Restore configuration
 * @param {string} config.mongodbUri - MongoDB connection URI
 * @param {string} config.backupFolderPath - Base path for backups
 * @param {string} config.mongoToolsPath - Path to MongoDB tools (optional)
 * @param {string} config.backupFolder - Name of backup folder to restore
 * @returns {Promise<Object>} Restore result
 */
async function restoreBackup(config) {
    try {
        const { mongodbUri, backupFolderPath, mongoToolsPath, backupFolder } = config;

        const fullBackupPath = path.join(backupFolderPath, backupFolder);

        // Verify backup folder exists
        try {
            await fs.access(fullBackupPath);
        } catch (error) {
            throw new Error(`Backup folder not found: ${backupFolder}`);
        }

        // Extract target database name from URI
        const targetDbName = mongodbUri.split('/').pop().split('?')[0];

        // Check if backup has a database subfolder
        const backupContents = await fs.readdir(fullBackupPath);
        const dbFolders = [];

        for (const item of backupContents) {
            const itemPath = path.join(fullBackupPath, item);
            const stat = await fs.stat(itemPath);
            if (stat.isDirectory()) {
                dbFolders.push(item);
            }
        }

        // Determine the source database name from backup
        let sourceDbName = targetDbName;
        if (dbFolders.length > 0) {
            sourceDbName = dbFolders[0]; // Use first database folder found
            console.log(`[RESTORE] Found database in backup: ${sourceDbName}`);
        }

        // Build mongorestore command
        const mongorestoreCmd = mongoToolsPath
            ? path.join(mongoToolsPath, 'mongorestore')
            : 'mongorestore';

        // If source and target database names are different, we need to rename during restore
        let command;
        if (sourceDbName !== targetDbName) {
            console.log(`[RESTORE] Renaming database from ${sourceDbName} to ${targetDbName}`);
            // Use --nsFrom and --nsTo to rename database during restore
            command = `"${mongorestoreCmd}" --uri="${mongodbUri}" --drop --nsFrom="${sourceDbName}.*" --nsTo="${targetDbName}.*" "${fullBackupPath}"`;
        } else {
            // Standard restore - use --drop to replace existing data
            command = `"${mongorestoreCmd}" --uri="${mongodbUri}" --drop "${fullBackupPath}"`;
        }

        console.log(`[RESTORE] Starting restore from: ${backupFolder}`);
        console.log(`[RESTORE] Command: ${command.replace(mongodbUri, 'HIDDEN_URI')}`);

        // Execute mongorestore
        const { stdout, stderr } = await execPromise(command, {
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        if (stderr && !stderr.includes('done')) {
            console.error(`[RESTORE] Warning: ${stderr}`);
        }

        console.log(`[RESTORE] Success: ${backupFolder}`);
        console.log(`[RESTORE] Restored to database: ${targetDbName}`);

        return {
            success: true,
            backupFolder,
            timestamp: new Date(),
            message: `Database restored successfully to ${targetDbName}`
        };

    } catch (error) {
        console.error('[RESTORE] Error:', error.message);
        throw new Error(`Restore failed: ${error.message}`);
    }
}


/**
 * Get list of available backup folders
 * @param {string} backupFolderPath - Base path for backups
 * @param {string} autoBackupTime - Optional configured auto backup time (HH:mm) to infer type for legacy backups
 * @returns {Promise<Array>} List of backup folders with metadata
 */
async function getBackupsList(backupFolderPath, autoBackupTime) {
    try {
        // Ensure backup directory exists
        await fs.mkdir(backupFolderPath, { recursive: true });

        const files = await fs.readdir(backupFolderPath);

        const backups = [];

        for (const file of files) {
            if (file.startsWith('backup-')) {
                const fullPath = path.join(backupFolderPath, file);
                const stats = await fs.stat(fullPath);

                if (stats.isDirectory()) {
                    // Calculate folder size
                    const size = await getFolderSize(fullPath);

                    // Determine Type
                    // 1. Try reading metadata file (New System)
                    let type = null;
                    try {
                        const metaPath = path.join(fullPath, 'backup-info.json');
                        const metaContent = await fs.readFile(metaPath, 'utf8');
                        const meta = JSON.parse(metaContent);
                        if (meta.type) type = meta.type.charAt(0).toUpperCase() + meta.type.slice(1);
                    } catch (err) {
                        // Metadata missing -> Legacy Backup
                    }

                    // 2. If no metadata, infer from time (Legacy Support)
                    if (!type) {
                        const createdAt = stats.birthtime || stats.mtime;
                        // Format created time to HH:mm
                        const createdHours = createdAt.getHours().toString().padStart(2, '0');
                        const createdMinutes = createdAt.getMinutes().toString().padStart(2, '0');
                        const createdTime = `${createdHours}:${createdMinutes}`;

                        // Check if it matches autoBackupTime (allowing 1 min variance for execution delay)
                        if (autoBackupTime) {
                            const [autoH, autoM] = autoBackupTime.split(':');

                            // Simple check: Exact match
                            if (createdTime === autoBackupTime) {
                                type = 'Auto';
                            }
                            // Fuzzy check: allow being 1 minute late (e.g. scheduled 03:00, ran 03:00:01 or 03:01)
                            else if (autoH === createdHours && Math.abs(parseInt(createdMinutes) - parseInt(autoM)) <= 1) {
                                type = 'Auto';
                            }
                        }

                        // Default to Manual if inference failed
                        if (!type) type = 'Manual';
                    }

                    backups.push({
                        name: file,
                        path: fullPath,
                        createdAt: stats.birthtime || stats.mtime,
                        size: size,
                        sizeFormatted: formatBytes(size),
                        type: type
                    });
                }
            }
        }

        // Sort by creation date (newest first)
        backups.sort((a, b) => b.createdAt - a.createdAt);

        return backups;

    } catch (error) {
        console.error('[BACKUP LIST] Error:', error.message);
        return [];
    }
}

/**
 * Get backup information (last backup date and count)
 * @param {string} backupFolderPath - Base path for backups
 * @param {Date} lastBackupDate - Last backup date from settings
 * @returns {Promise<Object>} Backup information
 */
async function getBackupInfo(backupFolderPath, lastBackupDate) {
    try {
        const backups = await getBackupsList(backupFolderPath);

        return {
            lastBackupDate: lastBackupDate || (backups.length > 0 ? backups[0].createdAt : null),
            backupCount: backups.length,
            totalSize: backups.reduce((sum, b) => sum + b.size, 0),
            totalSizeFormatted: formatBytes(backups.reduce((sum, b) => sum + b.size, 0))
        };

    } catch (error) {
        console.error('[BACKUP INFO] Error:', error.message);
        return {
            lastBackupDate: null,
            backupCount: 0,
            totalSize: 0,
            totalSizeFormatted: '0 B'
        };
    }
}

/**
 * Delete a specific backup folder
 * @param {string} backupFolderPath - Base path for backups
 * @param {string} backupFolder - Name of backup folder to delete
 * @returns {Promise<Object>} Delete result
 */
async function deleteBackup(backupFolderPath, backupFolder) {
    try {
        const fullPath = path.join(backupFolderPath, backupFolder);

        // Verify it's a backup folder
        if (!backupFolder.startsWith('backup-')) {
            throw new Error('Invalid backup folder name');
        }

        // Delete the folder recursively
        await fs.rm(fullPath, { recursive: true, force: true });

        console.log(`[DELETE] Backup deleted: ${backupFolder}`);

        return {
            success: true,
            message: 'Backup deleted successfully'
        };

    } catch (error) {
        console.error('[DELETE] Error:', error.message);
        throw new Error(`Delete failed: ${error.message}`);
    }
}

/**
 * Clean old backups based on retention days
 * @param {string} backupFolderPath - Base path for backups
 * @param {number} retentionDays - Number of days to keep backups
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanOldBackups(backupFolderPath, retentionDays) {
    try {
        const backups = await getBackupsList(backupFolderPath);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        let deletedCount = 0;

        for (const backup of backups) {
            if (backup.createdAt < cutoffDate) {
                await deleteBackup(backupFolderPath, backup.name);
                deletedCount++;
            }
        }

        console.log(`[CLEANUP] Deleted ${deletedCount} old backups`);

        return {
            success: true,
            deletedCount,
            message: `Cleaned up ${deletedCount} old backups`
        };

    } catch (error) {
        console.error('[CLEANUP] Error:', error.message);
        return {
            success: false,
            deletedCount: 0,
            message: `Cleanup failed: ${error.message}`
        };
    }
}

/**
 * Calculate folder size recursively
 * @param {string} folderPath - Path to folder
 * @returns {Promise<number>} Size in bytes
 */
async function getFolderSize(folderPath) {
    let totalSize = 0;

    try {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isDirectory()) {
                totalSize += await getFolderSize(filePath);
            } else {
                totalSize += stats.size;
            }
        }
    } catch (error) {
        console.error(`Error calculating folder size: ${error.message}`);
    }

    return totalSize;
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
    createBackup,
    restoreBackup,
    getBackupsList,
    getBackupInfo,
    deleteBackup,
    cleanOldBackups
};
