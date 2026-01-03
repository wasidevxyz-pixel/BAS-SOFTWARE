
let suppliers = [];
let categories = [];
let branches = [];
let cashAccounts = [];
let loadedVouchers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.value = today;
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const rights = user.rights || {};
    const isAdmin = user.role === 'admin' || (user.group && user.group.isAdmin) || (user.groupId && user.groupId.isAdmin);

    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    // Force context isolation if tabParam is present (User requested separate screens)
    let forceSupplier = tabParam === 'supplier';
    let forceCategory = tabParam === 'category';

    const canSupplier = (isAdmin || rights.pv_supplier) && !forceCategory;
    const canCategory = (isAdmin || rights.pv_category) && !forceSupplier;

    // Update page title if isolated
    if (forceSupplier || forceCategory) {
        const titleEl = document.querySelector('.page-title');
        if (titleEl) {
            titleEl.textContent = forceSupplier ? 'Supplier Voucher List' : 'Category Voucher List';
        }
    }

    // Hiding Tabs (Entry Page)
    if (!canSupplier && document.getElementById('tab-li-supplier')) {
        document.getElementById('tab-li-supplier').style.display = 'none';
        document.getElementById('supplier-content')?.classList.remove('active', 'show');
    }
    if (!canCategory && document.getElementById('tab-li-category')) {
        document.getElementById('tab-li-category').style.display = 'none';
        document.getElementById('category-content')?.classList.remove('active', 'show');
        if (canSupplier) {
            const supTab = new bootstrap.Tab(document.getElementById('supplier-tab'));
            supTab.show();
        }
    }

    // Hiding Tabs (List Page)
    if (!canSupplier && document.getElementById('list-tab-li-supplier')) {
        document.getElementById('list-tab-li-supplier').style.display = 'none';
    }
    if (!canCategory && document.getElementById('list-tab-li-category')) {
        document.getElementById('list-tab-li-category').style.display = 'none';
        if (canSupplier && document.getElementById('list-supplier-tab')) {
            const supTab = new bootstrap.Tab(document.getElementById('list-supplier-tab'));
            supTab.show();
        }
    }

    // Default activation logic if current active tab is hidden
    if (!canSupplier && canCategory) {
        const catTabEl = document.getElementById('category-tab') || document.getElementById('list-category-tab');
        if (catTabEl) {
            const catTab = new bootstrap.Tab(catTabEl);
            catTab.show();
        }
    }

    // Fix for tabs displaying below each other (stacking issue)
    const voucherTabs = document.querySelectorAll('#paymentTabs button[data-bs-toggle="tab"]');
    voucherTabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (e) {
            const targetId = e.target.getAttribute('data-bs-target');
            document.querySelectorAll('#paymentTabsContent .tab-pane').forEach(pane => {
                if ('#' + pane.id !== targetId) {
                    pane.classList.remove('show', 'active');
                }
            });
        });
    });

    await loadInitialData();

    // Navigation and tab handling - Use Bootstrap Tab API for reliability
    // Check if we are on the list page first
    const isListPage = window.location.pathname.includes('payment-vouchers-list');

    if (tabParam === 'category') {
        // For list page, prefer list-category-tab; for entry page, prefer category-tab
        const catTabEl = isListPage
            ? document.getElementById('list-category-tab')
            : (document.getElementById('category-tab') || document.getElementById('list-category-tab'));
        if (catTabEl) {
            const tab = new bootstrap.Tab(catTabEl);
            tab.show();
        }
    } else if (tabParam === 'supplier') {
        const supTabEl = isListPage
            ? document.getElementById('list-supplier-tab')
            : (document.getElementById('supplier-tab') || document.getElementById('list-supplier-tab'));
        if (supTabEl) {
            const tab = new bootstrap.Tab(supTabEl);
            tab.show();
        }
    }

    // Update filter visibility based on active tab (for list page)
    updateFilterVisibility();

    await fetchVoucherList();
    await generateNextVoucherNo();

    // Form Submissions
    const supForm = document.getElementById('supplierVoucherForm');
    const catForm = document.getElementById('categoryVoucherForm');
    if (supForm) supForm.addEventListener('submit', handleSupplierVoucherSave);
    if (catForm) catForm.addEventListener('submit', handleCategoryVoucherSave);

    // Link Buttons on Entry Page
    document.querySelectorAll('.btn-view-list').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const container = e.target.closest('.tab-pane');
            const context = container && container.id.includes('category') ? 'category' : 'supplier';
            window.location.href = `/payment-vouchers-list.html?tab=${context}`;
        });
    });

    // Branch-wise Category Filtering
    document.getElementById('catBranchSelect')?.addEventListener('change', async (e) => {
        const branchId = e.target.value;
        await loadCategories(branchId);
    });

    // Branch-wise Supplier Filtering
    document.getElementById('branchSelect')?.addEventListener('change', async (e) => {
        const branchName = e.target.options[e.target.selectedIndex].text;
        await loadSuppliers(branchName);
    });
});

async function loadCategories(branchId = '') {
    try {
        const token = localStorage.getItem('token');
        // If your backend supports branch filtering for categories, use it here
        // For now, we fetch all customer categories
        const res = await fetch('/api/v1/customer-categories?limit=500', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('catCustomerCategory');
            if (!select) return;
            select.innerHTML = '<option value="">Select Category</option>';
            data.data.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                select.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function loadSuppliers(branchName = '') {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/parties?partyType=supplier&limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            // Filter suppliers by branch if branch is selected
            let filteredSuppliers = data.data;
            if (branchName) {
                filteredSuppliers = data.data.filter(s => s.branch === branchName);
            }

            suppliers = filteredSuppliers;
            const selects = ['supplierSelect', 'listSupplierFilter'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.innerHTML = '<option value="">Select Supplier</option>';
                filteredSuppliers.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.name;
                    opt.textContent = s.name;
                    el.appendChild(opt);
                });
            });
        }
    } catch (err) { console.error(err); }
}

async function loadInitialData() {
    try {
        const token = localStorage.getItem('token');

        // 1. Load Branches
        const branchRes = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const branchData = await branchRes.json();
        if (branchData.success) {
            branches = branchData.data;
            const selects = ['branchSelect', 'catBranchSelect', 'listBranchFilter'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                branches.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b._id;
                    opt.textContent = b.name;
                    el.appendChild(opt);
                });
            });
        }

        // 2. Load Suppliers (initially load all, will filter on branch selection)
        await loadSuppliers();

        // 3. Load Customer Categories
        const catRes = await fetch('/api/v1/customer-categories?limit=500', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const catData = await catRes.json();
        if (catData.success) {
            categories = catData.data;
            // Populate both entry dropdown and list filter dropdown
            const catSelects = ['catCustomerCategory', 'listCategoryFilter'];
            catSelects.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.textContent = c.name;
                    select.appendChild(opt);
                });
            });
        }

        // 4. Load Cash/Bank Accounts (for payment method context)
        // In this system, we usually have a few standard cash accounts
        // or we can fetch them from ledger accounts
        const accRes = await fetch('/api/v1/accounts/ledger', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const accData = await accRes.json();
        if (accData.success) {
            cashAccounts = accData.data.filter(a =>
                a.name.toLowerCase().includes('cash') ||
                a.name.toLowerCase().includes('bank')
            );
        }

    } catch (err) {
        console.error('Error loading initial data:', err);
    }
}

async function generateNextVoucherNo() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/vouchers/next-number/CPV', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const vInput = document.getElementById('voucherNo');
            if (vInput) vInput.value = data.data;

            const catInput = document.getElementById('catVoucherNo');
            if (catInput) catInput.value = data.data;
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleSupplierVoucherSave(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('voucherAmount').value);
    if (!amount || amount <= 0) return alert('Please enter valid amount');

    const supplier = document.getElementById('supplierSelect').value;
    if (!supplier) return alert('Please select supplier');

    const paymentMethod = document.getElementById('paymentMethod').value;
    let contraAccount = 'Cash in Hand'; // Default
    if (paymentMethod === 'Bank') contraAccount = 'Bank';

    const payload = {
        voucherType: paymentMethod === 'Bank' ? 'BPV' : 'CPV',
        date: document.getElementById('voucherDate').value,
        branch: document.getElementById('branchSelect').options[document.getElementById('branchSelect').selectedIndex].text,
        narration: document.getElementById('voucherDescription').value,
        voucherNo: document.getElementById('voucherNo').value,
        entries: [
            { account: supplier, debit: amount, credit: 0, detail: 'Supplier Payment' },
            { account: contraAccount, debit: 0, credit: amount, detail: 'Auto-balanced Payment' }
        ]
    };

    await saveVoucher(payload);
}

async function handleCategoryVoucherSave(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('catVoucherAmount').value);
    if (!amount || amount <= 0) return alert('Please enter valid amount');

    const category = document.getElementById('catCustomerCategory').value;
    if (!category) return alert('Please select category');

    const paymentMethod = document.getElementById('catPaymentMethod').value;
    let contraAccount = 'Cash in Hand';
    if (paymentMethod === 'Bank') contraAccount = 'Bank';

    const payload = {
        voucherType: paymentMethod === 'Bank' ? 'BPV' : 'CPV',
        date: document.getElementById('catVoucherDate').value,
        branch: document.getElementById('catBranchSelect').options[document.getElementById('catBranchSelect').selectedIndex].text,
        narration: document.getElementById('catVoucherDescription').value,
        voucherNo: document.getElementById('catVoucherNo').value,
        entries: [
            { account: category, debit: amount, credit: 0, detail: 'Category Wise Payment' },
            { account: contraAccount, debit: 0, credit: amount, detail: 'Auto-balanced Payment' }
        ]
    };

    await saveVoucher(payload);
}

async function saveVoucher(payload) {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            const token = localStorage.getItem('token');
            const res = await fetch('/api/v1/vouchers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                alert('Voucher Saved Successfully!');
                await window.resetForm('supplierVoucherForm');
                await window.resetForm('categoryVoucherForm');
                await fetchVoucherList();

                if (confirm('Do you want to print this voucher?')) {
                    printSingle(data.data._id);
                }
                return; // Success, exit function
            }

            // Check for duplicate key error (E11000)
            if (data.message && (data.message.includes('E11000') || data.message.includes('duplicate'))) {
                console.warn(`Duplicate voucher number ${payload.voucherNo} detected. Retrying with new number (Attempt ${attempts})...`);

                // Generate a fresh number for the current voucher type (CPV or BPV)
                let newNo = await generateVoucherNumber(payload.voucherType);

                // Guard against stale backend logic returning same number
                if (newNo === payload.voucherNo) {
                    const parts = newNo.split('-');
                    if (parts.length > 1) {
                        const num = parseInt(parts[parts.length - 1]);
                        if (!isNaN(num)) {
                            // Force increment
                            const prefix = parts[0]; // simplistic assumption, but works for CPV-01
                            newNo = `${parts.slice(0, -1).join('-')}-${String(num + 1).padStart(2, '0')}`;
                        }
                    }
                }

                if (newNo) {
                    // Update Payload
                    payload.voucherNo = newNo;

                    // Update UI to reflect the change (so user knows number changed)
                    if (document.getElementById('voucherNo')) document.getElementById('voucherNo').value = newNo;
                    if (document.getElementById('catVoucherNo')) document.getElementById('catVoucherNo').value = newNo;

                    // Continue loop to retry
                    continue;
                } else {
                    alert('Failed to generate a new voucher number. Please try again.');
                    return;
                }
            }

            // Other errors
            alert('Error: ' + data.message);
            return;

        } catch (err) {
            console.error(err);
            alert('Failed to save voucher during network request');
            return;
        }
    }

    alert('Failed to save voucher after multiple attempts due to high traffic. Please try again.');
}

async function fetchVoucherList() {
    try {
        const token = localStorage.getItem('token');
        const fromDate = document.getElementById('listFromDate')?.value || '';
        const toDate = document.getElementById('listToDate')?.value || '';

        // Fix: Filter by Branch Name (Text) not ID (Value) because DB stores Name
        const branchEl = document.getElementById('listBranchFilter');
        let branch = '';
        if (branchEl && branchEl.value) {
            branch = branchEl.options[branchEl.selectedIndex].text;
        }

        const supplier = document.getElementById('listSupplierFilter')?.value || '';

        let url = `/api/v1/vouchers?limit=100&sort=-date&startDate=${fromDate}&endDate=${toDate}`;

        if (branch) {
            url += `&branch=${encodeURIComponent(branch)}`;
        }

        if (supplier) {
            url += `&supplier=${encodeURIComponent(supplier)}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            loadedVouchers = data.data;
            renderVoucherTable();
        }
    } catch (err) {
        console.error(err);
    }
}

function renderVoucherTable() {
    const tbody = document.getElementById('voucherListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const activeTabId = document.querySelector('.nav-tabs-custom .nav-link.active')?.id;

    loadedVouchers.forEach(v => {
        // Find the "Main" entry (the debit side that isn't auto-balanced)
        const mainEntry = v.entries.find(e => !e.detail || !e.detail.includes('Auto-balanced'));
        const partyName = mainEntry ? mainEntry.account : 'N/A';

        // Detect if it's a category voucher (based on detail marker we set during save)
        const isCategory = mainEntry && mainEntry.detail === 'Category Wise Payment';

        // Filter based on active tab in List view
        if (activeTabId === 'list-supplier-tab' && isCategory) return;
        if (activeTabId === 'list-category-tab' && !isCategory) return;

        const badgeClass = isCategory ? 'badge-category' : 'badge-supplier';
        const badgeLabel = isCategory ? 'Category' : 'Supplier';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="voucher-check" value="${v._id}"></td>
            <td class="fw-bold">${v.voucherNo}</td>
            <td>${new Date(v.date).toLocaleDateString()}</td>
            <td><span class="${badgeClass}">${badgeLabel}</span> ${partyName}</td>
            <td>${v.branch || 'Shop'}</td>
            <td class="fw-bold">PKR ${(v.totalDebit || 0).toLocaleString()}</td>
            <td>${v.voucherType === 'CPV' ? 'Cash' : 'Bank'}</td>
            <td class="text-truncate" style="max-width: 150px;">${v.narration || '-'}</td>
            <td class="text-center action-btns">
                <button class="btn btn-sm btn-info text-white" onclick="printSingle('${v._id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-warning text-white" onclick="editVoucher('${v._id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteVoucher('${v._id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Add tab listener for list page
if (document.getElementById('listTabs')) {
    document.getElementById('listTabs').addEventListener('shown.bs.tab', () => {
        renderVoucherTable();
        updateFilterVisibility();
    });
}

// Update filter section visibility based on active tab
function updateFilterVisibility() {
    const activeTabId = document.querySelector('#listTabs .nav-link.active')?.id;
    const supplierFilterDiv = document.getElementById('listSupplierFilter')?.closest('.col-md-2');
    const categoryFilterDiv = document.getElementById('listCategoryFilter')?.closest('.col-md-2');

    if (activeTabId === 'list-category-tab') {
        // On Category tab - hide supplier filter, show category filter
        if (supplierFilterDiv) supplierFilterDiv.style.display = 'none';
        if (categoryFilterDiv) categoryFilterDiv.style.display = '';
    } else {
        // On Supplier tab - show supplier filter, hide category filter
        if (supplierFilterDiv) supplierFilterDiv.style.display = '';
        if (categoryFilterDiv) categoryFilterDiv.style.display = 'none';
    }
}

window.resetForm = function (id) {
    document.getElementById(id).reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('voucherDate').value = today;
    document.getElementById('catVoucherDate').value = today;
    generateNextVoucherNo();
}

window.applyFilters = fetchVoucherList;

window.toggleSelectAll = function () {
    const main = document.getElementById('selectAllVouchers');
    document.querySelectorAll('.voucher-check').forEach(c => c.checked = main.checked);
}

window.printSingle = function (id) {
    const win = window.open(`/payment-voucher-print.html?id=${id}`, '_blank');
}

window.printFullList = function () {
    const ids = loadedVouchers.map(v => v._id).join(',');
    window.open(`/payment-voucher-print.html?ids=${ids}`, '_blank');
}

window.printSelected = function () {
    const selected = Array.from(document.querySelectorAll('.voucher-check:checked')).map(c => c.value);
    if (selected.length === 0) return alert('Please select at least one voucher');
    window.open(`/payment-voucher-print.html?ids=${selected.join(',')}`, '_blank');
}

window.deleteVoucher = async function (id) {
    if (!confirm('Are you sure you want to delete this voucher?')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/vouchers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            alert('Voucher Deleted');
            fetchVoucherList();
        }
    } catch (err) { alert('Error deleting voucher'); }
}

window.openQuickAddCategory = function () {
    // We specify 'customer-category' as the type
    // After success, we reload the categories in the dropdown
    showQuickAddDialog('customer-category', async () => {
        const branchId = document.getElementById('catBranchSelect').value;
        await loadInitialData(); // This reloads categories for all relevant dropdowns
    });

    // The desktop-ui logic expects a select with id matching the type
    // In our case, the select is 'catCustomerCategory'. We'll adjust the logic 
    // to search for the correct select after a small delay.
    setTimeout(() => {
        const select = document.getElementById('catCustomerCategory');
        window._quickAddTargetSelectId = 'catCustomerCategory';
    }, 100);
};

window.editVoucher = function (id) {
    const v = loadedVouchers.find(x => x._id === id);
    if (!v) return;

    // Switch to appropriate tab
    const mainEntry = v.entries.find(e => !e.detail || !e.detail.includes('Auto-balanced'));
    if (mainEntry && mainEntry.detail === 'Category Wise Payment') {
        document.getElementById('category-tab').click();
        // Fill cat form...
    } else {
        document.getElementById('supplier-tab').click();
        // Fill supplier form...
    }

    // For now simplistic filling
    alert('Edit mode activated - showing data as reference.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Helper function to generate a fresh voucher number (CPV/BPV)
// Explicitly needed for the retry mechanism in saveVoucher
async function generateVoucherNumber(type) {
    try {
        const token = localStorage.getItem('token');
        // Type should be CPV, BPV, etc.
        const res = await fetch(`/api/v1/vouchers/next-number/${type}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            return data.data;
        }
        return null;
    } catch (err) {
        console.error('Error in generateVoucherNumber:', err);
        return null;
    }
}
