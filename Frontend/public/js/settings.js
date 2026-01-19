// Settings Management JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Set user name in navbar
    setUserName();

    // Initialize settings page
    initSettingsPage();

    // Setup permission-based tab visibility (must run before tab parameter handling)
    setupTabPermissions();

    // Handle tab parameter (e.g., ?tab=company, ?tab=invoice, ?tab=tax, ?tab=backup)
    // This runs AFTER permissions to ensure proper tab visibility
    handleTabParameter();
});

// Set user name in navbar
function setUserName() {
    const user = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = user.name || user.email;
    }
}

// Setup permission-based tab visibility
function setupTabPermissions() {
    // Check if a specific tab is requested via query parameter
    // If so, skip this entire function - handleTabParameter will handle everything
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTab = urlParams.get('tab');

    if (requestedTab) {
        console.log('Specific tab requested, skipping permission setup:', requestedTab);
        return; // Exit immediately
    }

    const user = getCurrentUser();
    if (!user) return;

    // Admin has full access
    if (user.role === 'admin' || (user.group && user.group.isAdmin) || (user.groupId && user.groupId.isAdmin)) {
        return; // Show all tabs for admin
    }

    // Get user rights
    let rights = user.rights || {};
    if (Object.keys(rights).length === 0) {
        if (user.group && user.group.rights) {
            rights = user.group.rights;
        } else if (user.groupId && user.groupId.rights) {
            rights = user.groupId.rights;
        }
    }

    console.log('User rights:', rights); // Debug log

    // Hide tabs based on permissions
    const tabItems = document.querySelectorAll('#settingsTabs .nav-item[data-permission]');
    let firstVisibleTab = null;
    let visibleCount = 0;

    tabItems.forEach(tabItem => {
        const permission = tabItem.getAttribute('data-permission');
        console.log('Checking permission:', permission, 'Has access:', rights[permission]); // Debug log

        if (permission && !rights[permission]) {
            // Hide the tab - user doesn't have this specific permission
            tabItem.style.display = 'none';
        } else {
            // Show the tab
            tabItem.style.display = '';
            visibleCount++;
            if (!firstVisibleTab) {
                // Track first visible tab
                firstVisibleTab = tabItem.querySelector('button');
            }
        }
    });

    console.log('Visible tabs count:', visibleCount); // Debug log

    // If no tabs are visible, hide the entire settings page or show a message
    if (visibleCount === 0) {
        const container = document.querySelector('.container-fluid.mt-4');
        if (container) {
            container.innerHTML = '<div class="alert alert-warning mt-4"><i class="fas fa-exclamation-triangle me-2"></i>You do not have permission to access any settings tabs. Please contact your administrator.</div>';
        }
        return;
    }

    // If the default active tab is hidden, activate the first visible tab
    const activeTab = document.querySelector('#settingsTabs .nav-link.active');
    const activeTabParent = activeTab ? activeTab.closest('.nav-item') : null;

    if (activeTabParent && activeTabParent.style.display === 'none' && firstVisibleTab) {
        // Remove active class from hidden tab
        activeTab.classList.remove('active');

        // Activate first visible tab
        firstVisibleTab.classList.add('active');

        // Show corresponding tab pane
        const targetId = firstVisibleTab.getAttribute('data-bs-target');
        if (targetId) {
            // Hide all tab panes
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('show', 'active');
            });

            // Show target pane
            const targetPane = document.querySelector(targetId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
        }
    }
}

// Handle tab parameter to show only selected tab
function handleTabParameter() {
    // Get the 'tab' query parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    if (!tabParam) {
        // No tab parameter - show all tabs (default behavior)
        return;
    }

    // Map tab parameter to tab IDs and content IDs
    const tabMap = {
        'company': { tabId: 'company-tab', contentId: 'company' },
        'invoice': { tabId: 'invoice-tab', contentId: 'invoice' },
        'tax': { tabId: 'tax-tab', contentId: 'tax' },
        'backup': { tabId: 'backup-tab', contentId: 'backup' }
    };

    const tabInfo = tabMap[tabParam];
    if (tabInfo) {
        const tabButton = document.getElementById(tabInfo.tabId);
        const tabParent = tabButton ? tabButton.closest('.nav-item') : null;

        if (tabButton && tabParent) {
            // Remove the initial hiding style
            const hideStyle = document.getElementById('tab-hide-style');
            if (hideStyle) {
                hideStyle.remove();
            }

            // Hide ALL tab buttons with !important
            document.querySelectorAll('#settingsTabs .nav-item').forEach(item => {
                item.style.setProperty('display', 'none', 'important');
            });

            // Hide ALL tab content panes
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('show', 'active');
                pane.style.setProperty('display', 'none', 'important');
            });

            // Show ONLY the selected tab button
            tabParent.style.setProperty('display', '', 'important');

            // Show ONLY the selected tab content
            const selectedContent = document.getElementById(tabInfo.contentId);
            if (selectedContent) {
                selectedContent.style.setProperty('display', 'block', 'important');
                selectedContent.classList.add('show', 'active');
            }

            // Activate the tab using Bootstrap's tab API
            const tab = new bootstrap.Tab(tabButton);
            tab.show();

            // Load backup configuration if backup tab is selected
            if (tabParam === 'backup') {
                // Use setTimeout to ensure DOM is ready
                setTimeout(() => {
                    if (typeof loadBackupInfo === 'function') loadBackupInfo();
                    if (typeof loadAvailableBackups === 'function') loadAvailableBackups();
                    if (typeof loadBackupConfiguration === 'function') loadBackupConfiguration();
                }, 100);
            }

            console.log('Showing only tab:', tabParam, 'Content:', tabInfo.contentId); // Debug log
        }
    }
}

// Initialize settings page
function initSettingsPage() {
    // Load all settings at once
    loadAllSettings();
    loadAllSettings();


    // Event listeners
    document.getElementById('companyForm').addEventListener('submit', handleCompanySubmit);
    document.getElementById('invoiceForm').addEventListener('submit', handleInvoiceSubmit);
    document.getElementById('taxForm').addEventListener('submit', handleTaxSubmit);

    // Logo preview
    document.getElementById('companyLogo').addEventListener('change', handleLogoChange);

    // Add scroll-to-view functionality for all tabs
    setupTabScrolling();
}

// Setup automatic scrolling when tabs are clicked
function setupTabScrolling() {
    const tabButtons = document.querySelectorAll('#settingsTabs button[data-bs-toggle="tab"]');

    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', function (event) {
            // Get the target tab pane ID from the button's data-bs-target attribute
            const targetId = event.target.getAttribute('data-bs-target');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Scroll to the tab content with smooth animation
                // Add a small delay to ensure the tab content is fully rendered
                setTimeout(() => {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }, 100);
            }
        });
    });
}

// Load all settings at once (optimization)
async function loadAllSettings() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            // Populate all tabs with the same data
            populateCompanySettings(data);
            populateInvoiceSettings(data);
            populateTaxSettings(data);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Populate company settings form
function populateCompanySettings(data) {
    const settings = data.data || data;
    document.getElementById('companyName').value = settings.companyName || '';
    document.getElementById('companyEmail').value = settings.email || '';
    document.getElementById('companyPhone').value = settings.phone || '';
    document.getElementById('companyWebsite').value = settings.website || '';
    document.getElementById('companyAddress').value = settings.address || '';
    document.getElementById('companyCity').value = settings.city || '';
    document.getElementById('companyState').value = settings.state || '';
    document.getElementById('companyPostalCode').value = settings.postalCode || '';
    document.getElementById('companyGSTIN').value = settings.taxNumber || '';
    document.getElementById('companyPAN').value = settings.pan || '';

    if (settings.logo) {
        document.getElementById('logoPreview').src = settings.logo;
        document.getElementById('logoPreview').style.display = 'block';
    }
}

// Populate invoice settings form
function populateInvoiceSettings(data) {
    const settings = data.data || data;
    document.getElementById('invoicePrefix').value = settings.invoicePrefix || '';
    document.getElementById('invoiceStartNumber').value = settings.invoiceStartNumber || 1;
    document.getElementById('billPrefix').value = settings.billPrefix || '';
    document.getElementById('billStartNumber').value = settings.billStartNumber || 1;
    document.getElementById('quotationPrefix').value = settings.quotationPrefix || '';
    document.getElementById('quotationStartNumber').value = settings.quotationStartNumber || 1;
    document.getElementById('invoiceTerms').value = settings.terms || '';
    document.getElementById('includeTaxInInvoice').checked = settings.includeTax || false;
    document.getElementById('includeLogoInInvoice').checked = settings.includeLogo || false;
}

// Populate tax settings form
function populateTaxSettings(data) {
    const settings = data.data || data;
    document.getElementById('defaultTaxRate').value = settings.defaultTaxPercent || 0;
    document.getElementById('cgstRate').value = settings.cgstRate || 0;
    document.getElementById('sgstRate').value = settings.sgstRate || 0;
    document.getElementById('igstRate').value = settings.igstRate || 0;
    document.getElementById('cessRate').value = settings.cessRate || 0;
    document.getElementById('enableReverseCharge').checked = settings.enableReverseCharge || false;
}

// Load company settings
async function loadCompanySettings() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const settings = data.data;

            // Fill company form
            document.getElementById('companyName').value = settings.companyName || '';
            document.getElementById('companyEmail').value = settings.email || '';
            document.getElementById('companyPhone').value = settings.phone || '';
            document.getElementById('companyWebsite').value = settings.website || '';
            document.getElementById('companyAddress').value = settings.address || '';
            document.getElementById('companyCity').value = settings.city || '';
            document.getElementById('companyState').value = settings.state || '';
            document.getElementById('companyPostalCode').value = settings.postalCode || '';
            document.getElementById('companyGSTIN').value = settings.taxNumber || '';
            document.getElementById('companyPAN').value = settings.pan || '';

            // Show logo if exists
            if (settings.logo) {
                document.getElementById('logoPreview').src = settings.logo;
                document.getElementById('logoPreview').style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading company settings:', error);
    }
}

// Load invoice settings
async function loadInvoiceSettings() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const settings = data.data;

            // Fill invoice form
            document.getElementById('invoicePrefix').value = settings.invoicePrefix || 'INV';
            // These fields might not persist if not in schema, but we fill them if they exist in response
            document.getElementById('invoiceStartNumber').value = settings.invoiceStartNumber || 1;
            document.getElementById('billPrefix').value = settings.billPrefix || 'BILL';
            document.getElementById('billStartNumber').value = settings.billStartNumber || 1;
            document.getElementById('quotationPrefix').value = settings.quotationPrefix || 'QUOT';
            document.getElementById('quotationStartNumber').value = settings.quotationStartNumber || 1;
            document.getElementById('invoiceTerms').value = settings.terms || '';
            document.getElementById('includeTaxInInvoice').checked = settings.includeTax || false;
            document.getElementById('includeLogoInInvoice').checked = settings.includeLogo || false;
        }
    } catch (error) {
        console.error('Error loading invoice settings:', error);
    }
}

// Load tax settings
async function loadTaxSettings() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const settings = data.data;

            // Fill tax form
            document.getElementById('defaultTaxRate').value = settings.defaultTaxPercent || 0;
            document.getElementById('taxCalculationMethod').value = settings.taxType || 'exclusive'; // Assuming taxType maps to calculation method or similar
            // These might not be in schema
            document.getElementById('cgstRate').value = settings.cgstRate || 0;
            document.getElementById('sgstRate').value = settings.sgstRate || 0;
            document.getElementById('igstRate').value = settings.igstRate || 0;
            document.getElementById('cessRate').value = settings.cessRate || 0;
            document.getElementById('enableReverseCharge').checked = settings.enableReverseCharge || false;
        }
    } catch (error) {
        console.error('Error loading tax settings:', error);
    }
}



// Handle company form submit
async function handleCompanySubmit(e) {
    e.preventDefault();

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const formData = {
            companyName: document.getElementById('companyName').value,
            email: document.getElementById('companyEmail').value,
            phone: document.getElementById('companyPhone').value,
            website: document.getElementById('companyWebsite').value,
            address: document.getElementById('companyAddress').value,
            city: document.getElementById('companyCity').value,
            state: document.getElementById('companyState').value,
            postalCode: document.getElementById('companyPostalCode').value,
            taxNumber: document.getElementById('companyGSTIN').value,
            pan: document.getElementById('companyPAN').value
        };

        // Handle logo upload
        const logoPreview = document.getElementById('logoPreview');
        if (logoPreview && logoPreview.src && logoPreview.style.display !== 'none' && logoPreview.src.startsWith('data:image')) {
            formData.logo = logoPreview.src;
        }

        const response = await fetch('/api/v1/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showSuccess('Company settings updated successfully');
        } else {
            throw new Error('Failed to update settings');
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        showError('Failed to update settings');
    } finally {
        hideLoading();
    }
}

// Handle invoice form submit
async function handleInvoiceSubmit(e) {
    e.preventDefault();

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const formData = {
            invoicePrefix: document.getElementById('invoicePrefix').value,
            // Sending all fields, backend model might filter unknown ones
            invoiceStartNumber: parseInt(document.getElementById('invoiceStartNumber').value),
            billPrefix: document.getElementById('billPrefix').value,
            billStartNumber: parseInt(document.getElementById('billStartNumber').value),
            quotationPrefix: document.getElementById('quotationPrefix').value,
            quotationStartNumber: parseInt(document.getElementById('quotationStartNumber').value),
            terms: document.getElementById('invoiceTerms').value,
            includeTax: document.getElementById('includeTaxInInvoice').checked,
            includeLogo: document.getElementById('includeLogoInInvoice').checked
        };

        const response = await fetch('/api/v1/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showSuccess('Invoice settings updated successfully');
        } else {
            throw new Error('Failed to update settings');
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        showError('Failed to update settings');
    } finally {
        hideLoading();
    }
}

// Handle tax form submit
async function handleTaxSubmit(e) {
    e.preventDefault();

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const formData = {
            defaultTaxPercent: parseFloat(document.getElementById('defaultTaxRate').value) || 0,
            // Don't send taxType - it doesn't match the form field
            // taxType: document.getElementById('taxCalculationMethod').value,
            cgstRate: parseFloat(document.getElementById('cgstRate').value) || 0,
            sgstRate: parseFloat(document.getElementById('sgstRate').value) || 0,
            igstRate: parseFloat(document.getElementById('igstRate').value) || 0,
            cessRate: parseFloat(document.getElementById('cessRate').value) || 0,
            enableReverseCharge: document.getElementById('enableReverseCharge').checked
        };

        const response = await fetch('/api/v1/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showSuccess('Tax settings updated successfully');
        } else {
            throw new Error('Failed to update settings');
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        showError('Failed to update settings');
    } finally {
        hideLoading();
    }
}

// Handle backup settings submit
async function handleBackupSettingsSubmit(e) {
    e.preventDefault();

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const formData = {
            backupEnabled: document.getElementById('enableAutoBackup').checked,
            backupFrequency: document.getElementById('backupFrequency').value,
            backupRetentionDays: parseInt(document.getElementById('backupRetentionDays').value),
            // backupPath not in schema, ignoring
            // backupPath: document.getElementById('backupPath').value
        };

        const response = await fetch('/api/v1/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showSuccess('Backup settings updated successfully');
        } else {
            throw new Error('Failed to update settings');
        }
    } catch (error) {
        console.error('Error updating backup settings:', error);
        showError('Failed to update settings');
    } finally {
        hideLoading();
    }
}

// Handle logo change
function handleLogoChange(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('logoPreview').src = e.target.result;
            document.getElementById('logoPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}



// Create backup
async function createBackup() {
    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/backup/export', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showSuccess('Backup created successfully');
        } else {
            showError('Failed to create backup');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showError('Failed to create backup');
    } finally {
        hideLoading();
    }
}

// Restore backup
async function restoreBackup() {
    const fileInput = document.getElementById('backupFile');
    const file = fileInput.files[0];

    if (!file) {
        showError('Please select a backup file');
        return;
    }

    if (!confirm('Restoring from backup will overwrite all current data. Are you sure?')) {
        return;
    }

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('backup', file);

        const response = await fetch('/api/v1/backup/import', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (response.ok) {
            showSuccess('Backup restored successfully');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            showError('Failed to restore backup');
        }
    } catch (error) {
        console.error('Error restoring backup:', error);
        showError('Failed to restore backup');
    } finally {
        hideLoading();
    }
}

// ============================================
// MongoDB Backup & Restore Functions
// ============================================

// Load backup information on page load
document.addEventListener('DOMContentLoaded', function () {
    // Load backup info when backup tab is shown
    const backupTab = document.getElementById('backup-tab');
    if (backupTab) {
        backupTab.addEventListener('shown.bs.tab', function () {
            loadBackupInfo();
            loadAvailableBackups();
            loadBackupConfiguration();
        });
    }

    // Setup backup config form
    const backupConfigForm = document.getElementById('backupConfigForm');
    if (backupConfigForm) {
        backupConfigForm.addEventListener('submit', saveBackupConfiguration);
    }

    // Setup restore modal checkbox
    const confirmRestore = document.getElementById('confirmRestore');
    if (confirmRestore) {
        confirmRestore.addEventListener('change', function () {
            document.getElementById('confirmRestoreBtn').disabled = !this.checked;
        });
    }
});

/**
 * Load backup information (last backup date, count, size)
 */
async function loadBackupInfo() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/mongodb-backup/info', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const info = data.data;

            // Update UI
            document.getElementById('lastBackupDate').textContent =
                info.lastBackupDate ? new Date(info.lastBackupDate).toLocaleString() : 'Never';
            document.getElementById('backupCount').textContent = info.backupCount || '0';
            document.getElementById('totalBackupSize').textContent = info.totalSizeFormatted || '0 B';
        } else {
            console.error('Failed to load backup info');
        }
    } catch (error) {
        console.error('Error loading backup info:', error);
    }
}

/**
 * Perform manual backup
 */
async function performManualBackup() {
    const btn = document.getElementById('manualBackupBtn');
    const originalText = btn.innerHTML;

    try {
        // Show loading state
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating Backup...';

        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/mongodb-backup/manual', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok) {
            showBackupAlert('success', `✓ Backup created successfully: ${result.data.backupFolder}`);
            // Reload backup info and list
            loadBackupInfo();
            loadAvailableBackups();
        } else {
            showBackupAlert('danger', `✗ Backup failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showBackupAlert('danger', '✗ Backup failed: ' + error.message);
    } finally {
        // Restore button state
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Load available backups list
 */
async function loadAvailableBackups() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/mongodb-backup/list', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const backups = data.data;

            const tbody = document.getElementById('backupsTableBody');

            if (backups.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-muted">
                            <i class="fas fa-folder-open me-2"></i>No backups available
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = backups.map(backup => `
                <tr>
                    <td>
                        <i class="fas fa-folder text-warning me-2"></i>
                        <code>${backup.name}</code>
                    </td>
                    <td>${new Date(backup.createdAt).toLocaleString()}</td>
                    <td>
                        <span class="badge ${backup.type === 'Auto' ? 'bg-info' : 'bg-secondary'}">
                            ${backup.type || 'Manual'}
                        </span>
                    </td>
                    <td>${backup.sizeFormatted}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-warning me-1" onclick="restoreBackupFromList('${backup.name}')" title="Restore">
                            <i class="fas fa-upload"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBackupFromList('${backup.name}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');

            // Also update restore modal dropdown
            updateRestoreDropdown(backups);
        } else {
            console.error('Failed to load backups list');
        }
    } catch (error) {
        console.error('Error loading backups:', error);
    }
}

/**
 * Update restore modal dropdown with available backups
 */
function updateRestoreDropdown(backups) {
    const select = document.getElementById('restoreBackupSelect');
    if (!select) return;

    if (backups.length === 0) {
        select.innerHTML = '<option value="">No backups available</option>';
        return;
    }

    select.innerHTML = '<option value="">Select a backup...</option>' +
        backups.map(backup =>
            `<option value="${backup.name}">${backup.name} (${new Date(backup.createdAt).toLocaleString()})</option>`
        ).join('');
}

/**
 * Show restore modal
 */
function showRestoreModal() {
    // Load backups first
    loadAvailableBackups();

    // Reset modal state
    document.getElementById('confirmRestore').checked = false;
    document.getElementById('confirmRestoreBtn').disabled = true;

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('restoreModal'));
    modal.show();
}

/**
 * Restore backup from list (quick restore)
 */
function restoreBackupFromList(backupName) {
    // Set the backup in dropdown
    document.getElementById('restoreBackupSelect').value = backupName;

    // Show modal
    showRestoreModal();
}

/**
 * Perform restore operation
 */
async function performRestore() {
    const backupFolder = document.getElementById('restoreBackupSelect').value;

    if (!backupFolder) {
        showBackupAlert('warning', 'Please select a backup to restore');
        return;
    }

    const btn = document.getElementById('confirmRestoreBtn');
    const originalText = btn.innerHTML;

    try {
        // Show loading state
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Restoring...';

        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/mongodb-backup/restore', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ backupFolder })
        });

        const result = await response.json();

        if (response.ok) {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('restoreModal')).hide();

            showBackupAlert('success', '✓ Database restored successfully! Page will reload in 3 seconds...');

            // Reload page after 3 seconds
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            showBackupAlert('danger', `✗ Restore failed: ${result.message}`);
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error restoring backup:', error);
        showBackupAlert('danger', '✗ Restore failed: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Delete backup from list
 */
async function deleteBackupFromList(backupName) {
    if (!confirm(`Are you sure you want to delete backup: ${backupName}?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/mongodb-backup/${encodeURIComponent(backupName)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (response.ok) {
            showBackupAlert('success', '✓ Backup deleted successfully');
            loadBackupInfo();
            loadAvailableBackups();
        } else {
            showBackupAlert('danger', `✗ Delete failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Error deleting backup:', error);
        showBackupAlert('danger', '✗ Delete failed: ' + error.message);
    }
}

/**
 * Load backup configuration
 */
async function loadBackupConfiguration() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/mongodb-backup/info', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const info = data.data;

            // Populate form
            document.getElementById('backupFolderPath').value = info.backupFolderPath || './backups';
            document.getElementById('mongoToolsPath').value = info.mongoToolsPath || '';
            document.getElementById('autoBackupEnabled').checked = info.autoBackupEnabled || false;
            document.getElementById('autoBackupTime').value = info.autoBackupTime || '02:00';
        }
    } catch (error) {
        console.error('Error loading backup configuration:', error);
    }
}

/**
 * Save backup configuration
 */
async function saveBackupConfiguration(e) {
    e.preventDefault();

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const formData = {
            backupFolderPath: document.getElementById('backupFolderPath').value,
            mongoToolsPath: document.getElementById('mongoToolsPath').value,
            autoBackupEnabled: document.getElementById('autoBackupEnabled').checked,
            autoBackupTime: document.getElementById('autoBackupTime').value
        };

        const response = await fetch('/api/v1/mongodb-backup/settings', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            showBackupAlert('success', '✓ Backup configuration saved successfully');
        } else {
            showBackupAlert('danger', `✗ Save failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Error saving backup configuration:', error);
        showBackupAlert('danger', '✗ Save failed: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Show backup alert message
 */
function showBackupAlert(type, message) {
    const container = document.getElementById('backupAlertContainer');
    if (!container) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    container.innerHTML = '';
    container.appendChild(alert);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
