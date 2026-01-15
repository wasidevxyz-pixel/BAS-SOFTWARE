const express = require('express');
const router = express.Router();
const {
    manualBackup,
    restoreFromBackup,
    getBackupInformation,
    getAvailableBackups,
    deleteBackupFolder,
    updateBackupSettings
} = require('../controllers/mongoBackupController');
const { protect, adminAccess } = require('../middleware/auth');

/**
 * MongoDB Backup Routes
 * All routes require authentication and admin access
 */

// Manual backup creation
router.post('/manual', protect, adminAccess, manualBackup);

// Restore from backup
router.post('/restore', protect, adminAccess, restoreFromBackup);

// Get backup information
router.get('/info', protect, adminAccess, getBackupInformation);

// Get list of available backups
router.get('/list', protect, adminAccess, getAvailableBackups);

// Delete specific backup
router.delete('/:foldername', protect, adminAccess, deleteBackupFolder);

// Update backup settings
router.put('/settings', protect, adminAccess, updateBackupSettings);

module.exports = router;
