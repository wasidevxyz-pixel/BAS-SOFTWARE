# MongoDB Backup & Restore System

## Overview
Complete MongoDB backup and restore system with automatic daily backups, manual backup creation, and database restoration capabilities.

## Features
- ✅ **Automatic Daily Backups** using node-cron
- ✅ **Manual Backup Creation** via Settings tab
- ✅ **Database Restoration** from any backup
- ✅ **Backup Management** - view, delete backups
- ✅ **Backup Information** - last backup date, total backups, total size
- ✅ **Configurable Settings** - backup path, auto-backup time, MongoDB tools path
- ✅ **Professional UI** with loading states and notifications
- ✅ **Data Safety** - confirmation dialogs before restore

## Prerequisites

### MongoDB Database Tools
This system requires MongoDB Database Tools (`mongodump` and `mongorestore`) to be installed.

#### Windows Installation:
1. Download MongoDB Database Tools from: https://www.mongodb.com/try/download/database-tools
2. Extract the ZIP file
3. Add the `bin` folder to your system PATH, or
4. Specify the full path in Settings > Backup > MongoDB Tools Path

#### Verify Installation:
```powershell
mongodump --version
mongorestore --version
```

## Configuration

### Default Settings
- **Backup Folder Path**: `./backups` (relative to Backend folder)
- **Auto-Backup Time**: `02:00` (2:00 AM daily)
- **Auto-Backup Enabled**: `true`
- **MongoDB URI**: From `process.env.MONGO_URI` or `mongodb://localhost:27017/sales-inventory`

### Customize Settings
1. Navigate to **Settings** > **Backup** tab
2. Configure:
   - Backup Folder Path (e.g., `d:\BAS-LIVE\BAS-SOFTWARE\backups`)
   - MongoDB Tools Path (leave empty if in system PATH)
   - Enable/Disable Automatic Backup
   - Set Daily Backup Time
3. Click **Save Configuration**

## Usage

### Manual Backup
1. Go to **Settings** > **Backup** tab
2. Click **Backup Now** button
3. Wait for confirmation message
4. Backup will be created with timestamp: `backup-YYYY-MM-DDTHH-MM-SS-msZ`

### Restore Database
1. Go to **Settings** > **Backup** tab
2. Click **Restore** button
3. Select backup from dropdown
4. Check "I understand that this will replace all existing data"
5. Click **Restore Backup**
6. Page will reload after successful restoration

### View Backups
- All available backups are listed in the table
- Shows: Backup Name, Date Created, Size
- Actions: Restore (quick), Delete

### Delete Backup
1. Find backup in the list
2. Click red trash icon
3. Confirm deletion

## Automatic Backups

### How It Works
- Runs daily at configured time (default: 2:00 AM)
- Creates timestamped backup folder
- Updates last backup date in settings
- Cleans old backups based on retention days (if configured)

### Scheduler Logs
Check server console for backup scheduler messages:
```
[AUTO-BACKUP] Scheduler initialized. Daily backup at 02:00
[AUTO-BACKUP] Starting scheduled backup...
[AUTO-BACKUP] ✓ Backup completed: backup-2026-01-15T02-00-00-000Z
```

### Disable Automatic Backups
1. Go to **Settings** > **Backup** tab
2. Uncheck "Enable Automatic Daily Backup"
3. Click **Save Configuration**

## Backup Structure

### Folder Format
```
backups/
├── backup-2026-01-15T12-30-00-000Z/
│   └── sales-inventory/
│       ├── collection1.bson
│       ├── collection1.metadata.json
│       ├── collection2.bson
│       └── collection2.metadata.json
└── backup-2026-01-14T02-00-00-000Z/
    └── sales-inventory/
        └── ...
```

### Naming Convention
- Format: `backup-YYYY-MM-DDTHH-MM-SS-msZ`
- Example: `backup-2026-01-15T12-30-45-123Z`
- Timezone: UTC (Z suffix)

## API Endpoints

### Manual Backup
```
POST /api/v1/mongodb-backup/manual
Authorization: Bearer <token>
```

### Restore Backup
```
POST /api/v1/mongodb-backup/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "backupFolder": "backup-2026-01-15T12-30-00-000Z"
}
```

### Get Backup Info
```
GET /api/v1/mongodb-backup/info
Authorization: Bearer <token>
```

### List Backups
```
GET /api/v1/mongodb-backup/list
Authorization: Bearer <token>
```

### Delete Backup
```
DELETE /api/v1/mongodb-backup/:foldername
Authorization: Bearer <token>
```

### Update Settings
```
PUT /api/v1/mongodb-backup/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "backupFolderPath": "./backups",
  "mongoToolsPath": "",
  "autoBackupEnabled": true,
  "autoBackupTime": "02:00"
}
```

## Troubleshooting

### "mongodump is not recognized"
- MongoDB Database Tools not installed or not in PATH
- Solution: Install tools and add to PATH, or specify full path in settings

### "Backup failed: spawn mongodump ENOENT"
- MongoDB tools path is incorrect
- Solution: Verify installation and update MongoDB Tools Path in settings

### "Restore failed: Backup folder not found"
- Selected backup doesn't exist
- Solution: Refresh backup list and select valid backup

### Automatic backup not running
- Check if auto-backup is enabled in settings
- Verify backup time configuration
- Check server logs for scheduler messages

### Permission errors
- Backup folder path not writable
- Solution: Ensure application has write permissions to backup folder

## Best Practices

1. **Regular Backups**: Keep automatic backups enabled
2. **Test Restores**: Periodically test restore functionality
3. **Backup Storage**: Store backups on separate drive/location
4. **Retention Policy**: Configure retention days to manage disk space
5. **Before Updates**: Always create manual backup before major updates
6. **Monitor Logs**: Check server logs for backup success/failure

## Security Notes

- Backups contain complete database data
- Secure backup folder with appropriate permissions
- Backup folder should not be publicly accessible
- Consider encrypting backup folder for sensitive data
- Restore operation requires admin access

## Support

For issues or questions:
1. Check server console logs
2. Verify MongoDB tools installation
3. Review backup folder permissions
4. Check MongoDB connection string

## Version
- Version: 1.0.0
- Last Updated: 2026-01-15
- Compatible with: MongoDB 4.0+
