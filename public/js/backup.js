document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
});

const API_BASE = '/api/v1/mongodb-backup';

// DOM Elements
const form = document.getElementById('backupSettingsForm');
const btnManualBackup = document.getElementById('btnManualBackup');
const btnRestore = document.getElementById('btnRestore');
const restoreModal = document.getElementById('restoreModal');
const closeModalSpans = document.querySelectorAll('.close-modal, .close-modal-btn');
const btnConfirmRestore = document.getElementById('btnConfirmRestore');
const confirmInput = document.getElementById('confirmInput');

// Load initial settings and stats
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/info`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            // Stats
            document.getElementById('lastBackupDate').textContent = data.lastBackupDate ? new Date(data.lastBackupDate).toLocaleString() : 'Never';
            document.getElementById('totalBackups').textContent = data.backupCount || 0;
            document.getElementById('totalSize').textContent = data.totalSizeFormatted || '0 B';

            // Settings Form
            document.getElementById('autoBackupEnabled').checked = data.autoBackupEnabled;
            document.getElementById('autoBackupTime').value = data.autoBackupTime;
            document.getElementById('backupFolderPath').value = data.backupFolderPath;
            document.getElementById('mongoToolsPath').value = data.mongoToolsPath;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('Failed to load backup settings', 'error');
    }
}

function setupEventListeners() {
    // Save Settings
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const settings = {
            autoBackupEnabled: document.getElementById('autoBackupEnabled').checked,
            autoBackupTime: document.getElementById('autoBackupTime').value,
            backupFolderPath: document.getElementById('backupFolderPath').value,
            mongoToolsPath: document.getElementById('mongoToolsPath').value
        };

        try {
            const response = await fetch(`${API_BASE}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const result = await response.json();

            if (result.success) {
                showNotification('Settings saved successfully', 'success');
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            showNotification('Error saving settings', 'error');
        }
    });

    // Manual Backup
    btnManualBackup.addEventListener('click', async () => {
        btnManualBackup.disabled = true;
        btnManualBackup.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Backing up...';

        try {
            const response = await fetch(`${API_BASE}/manual`, { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                showNotification('Backup created successfully!', 'success');
                loadSettings(); // Refresh stats
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            showNotification('Backup failed: Server error', 'error');
        } finally {
            btnManualBackup.disabled = false;
            btnManualBackup.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> BACKUP NOW';
        }
    });

    // Restore Button - Open Modal
    btnRestore.addEventListener('click', () => {
        const path = document.getElementById('restoreFolderPath').value.trim();
        if (!path) {
            showNotification('Please enter a backup folder path', 'warning');
            return;
        }
        document.getElementById('modalRestorePath').textContent = path;
        restoreModal.style.display = 'block';
        confirmInput.value = '';
        btnConfirmRestore.disabled = true;
    });

    // Close Modal
    closeModalSpans.forEach(span => {
        span.addEventListener('click', () => {
            restoreModal.style.display = 'none';
        });
    });

    // Confirm Input Logic
    confirmInput.addEventListener('input', (e) => {
        btnConfirmRestore.disabled = e.target.value !== 'CONFIRM';
    });

    // Confirm Restore Action
    btnConfirmRestore.addEventListener('click', async () => {
        const backupFolder = document.getElementById('modalRestorePath').textContent;
        // Extract folder name if full path is given, or use as is
        // The API expects 'backupFolder' which might be just name if base path is set, 
        // BUT our plan says user inputs path. 
        // Let's assume the API logic in mongoBackupController uses 'backupFolder' combined with configured path.
        // Or if user provided absolute path, we might need adjustments.
        // Re-reading controller: `path.join(settings.backupFolderPath, backupFolder)`
        // So User should input the FOLDER NAME if it's inside the configured backup path.
        // Let's assume user extracts the name or pastes local path relative to backup folder? 
        // The prompt asked for "set location... and full backup", usually means "C:\Backups\backup-2023..."
        // The controller logic `restoreFromBackup` uses `path.join(backupFolderPath, backupFolder)`.
        // So the input should be the FOLDER NAME (e.g., 'backup-2026-01-14...').

        btnConfirmRestore.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restoring...';
        btnConfirmRestore.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backupFolder: backupFolder })
            });
            const result = await response.json();

            if (result.success) {
                showNotification('Database restored successfully! Reloading...', 'success');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                showNotification(result.message || 'Restore failed', 'error');
                btnConfirmRestore.innerHTML = 'Yes, Restore Database';
                btnConfirmRestore.disabled = false; // Allow retry or cancel
            }
        } catch (error) {
            showNotification('Restore failed: Server error', 'error');
            btnConfirmRestore.disabled = false;
        }
    });

    // Click outside modal to close
    window.onclick = function (event) {
        if (event.target == restoreModal) {
            restoreModal.style.display = "none";
        }
    }
}

function showNotification(message, type = 'info') {
    // Simple alert for now, or use existing notification system if available
    // Assuming a global 'showToast' or similar exists, otherwise fallback
    if (typeof showToast === 'function') {
        showToast(message, type);
    } else {
        alert(message);
    }
}
