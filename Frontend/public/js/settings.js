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
});

// Set user name in navbar
function setUserName() {
    const user = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = user.name || user.email;
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
    document.getElementById('backupSettingsForm').addEventListener('submit', handleBackupSettingsSubmit);

    // Logo preview
    document.getElementById('companyLogo').addEventListener('change', handleLogoChange);
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

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
