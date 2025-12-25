document.addEventListener('DOMContentLoaded', async () => {
    // Set current date
    document.getElementById('date').valueAsDate = new Date();

    // Set User
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'Unknown' };
    document.getElementById('userName').textContent = user.name;
    document.getElementById('user').value = user.name;

    await loadBranches();
    loadDepartments();
    renderDenominations();

    document.getElementById('branch').addEventListener('change', () => { loadDepartments(); loadBankList(); });
    document.getElementById('mode').addEventListener('change', toggleMode);
    document.getElementById('department').addEventListener('change', loadBankList);
    document.getElementById('bankSelect').addEventListener('change', onBankSelect);

});

function toggleMode() {
    const mode = document.getElementById('mode').value;
    const isBank = mode === 'Bank';

    document.getElementById('leftCol').className = isBank ? 'col-md-12' : 'col-md-4';
    document.getElementById('rightCol').className = isBank ? 'd-none' : 'col-md-8';

    document.getElementById('bankContainer').style.display = isBank ? 'block' : 'none';
    document.getElementById('amountContainer').style.display = isBank ? 'block' : 'none';
    document.getElementById('deductionFields').style.display = isBank ? 'block' : 'none';

    document.getElementById('slipContainer').style.display = isBank ? 'none' : 'block';
    document.getElementById('bigCashContainer').style.display = isBank ? 'none' : 'block';

    if (isBank) loadBankList();
}

let allBanks = [];
async function loadBankList() {
    try {
        if (allBanks.length === 0) {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/v1/banks', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await response.json();
            if (data.success) allBanks = data.data;
        }

        const branch = document.getElementById('branch').value;
        const deptId = document.getElementById('department').value;
        const select = document.getElementById('bankSelect');
        const current = select.value;

        select.innerHTML = '<option value="">Select Bank</option>';

        const filtered = allBanks.filter(b => {
            if (b.branch !== branch) return false;
            // If bank has department, must match selected department
            if (b.department && b.department !== deptId) return false;

            // Filter: Hide banks of type 'Branch Bank' (only for Pending Chq)
            if (b.bankType === 'Branch Bank') return false;

            return true;
        });

        filtered.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b._id;
            opt.textContent = b.bankName + (b.department ? ' (' + (getDeptName(b.department) || 'Dept') + ')' : ''); // Ideally get name
            // For now just Bank Name
            opt.textContent = b.bankName;
            // Storing deduction in dataset
            opt.dataset.deduction = b.deduction || 0;
            select.appendChild(opt);
        });
        if (current) select.value = current;

    } catch (e) { console.error(e); }
}

function getDeptName(id) {
    const sel = document.getElementById('department');
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === id) return sel.options[i].text;
    }
    return '';
}

function onBankSelect() {
    const sel = document.getElementById('bankSelect');
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.deduction) {
        document.getElementById('deductedAmount').value = opt.dataset.deduction;
    }
}

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('branch');
            select.innerHTML = '<option value="">Select Branch</option>'; // Clear default options

            // Get Logged In User
            const user = JSON.parse(localStorage.getItem('user')) || {};
            const userBranch = user.branch;

            // Filter stores if user has a specific branch assigned
            const validStores = data.data.filter(store => {
                const uBranch = String(userBranch || '').trim().toLowerCase();

                // If user has "All Branches" access or no restriction
                if (!uBranch || uBranch.includes('all branches')) return true;

                const sName = (store.name || '').trim().toLowerCase();
                // Check if the store name is contained within the user's branch string
                // The user's branch string appears to be formatted like "(Branch A), (Branch B)"
                return uBranch.includes(sName);
            });

            validStores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.name;
                option.textContent = store.name;
                select.appendChild(option);
            });

            // Auto-select if only one option (either by filter or actual single store)
            if (validStores.length === 1) {
                select.value = validStores[0].name;
                // Force trigger change to load departments
                select.dispatchEvent(new Event('change'));
            } else if (userBranch) {
                // Find matching option (case insensitive)
                const uBranch = String(userBranch).trim().toLowerCase();
                const match = validStores.find(s => (s.name || '').trim().toLowerCase() === uBranch);
                if (match) {
                    select.value = match.name;
                    select.dispatchEvent(new Event('change'));
                }
            }
        }
    } catch (e) {
        console.error('Error loading branches:', e);
    }
}

async function loadDepartments() {
    try {
        const token = localStorage.getItem('token');
        const branch = document.getElementById('branch').value;
        const response = await fetch('/api/v1/departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const select = document.getElementById('department');
        select.innerHTML = '<option value="">Select Department</option>';

        if (data.success) {
            const filtered = data.data
                .filter(d => d.branch === branch && d.isActive && !d.combineDepSales)
                .sort((a, b) => {
                    const codeA = parseInt(a.code) || 999999;
                    const codeB = parseInt(b.code) || 999999;
                    return codeA - codeB || a.name.localeCompare(b.name);
                });
            filtered.forEach(d => {
                // Filter: Hide specialized internal departments
                if (d.name === 'PERCENTAGE CASH' || d.name === 'CASH REC FROM COUNTER') return;

                // Filter: Hide if only 'Closing_2_Comp_Sale' is set
                if (d.closing2CompSale && !d.closing2DeptDropDown) return;

                const opt = document.createElement('option');
                opt.value = d._id;
                opt.text = d.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

const denoms = [5000, 1000, 500, 100, 75, 50, 20, 10, 5, 2, 1];

function renderDenominations() {
    const container = document.getElementById('denomContainer');
    container.innerHTML = '';

    denoms.forEach((val, index) => {
        const div = document.createElement('div');
        div.className = 'denom-row';
        div.innerHTML = `
            <div class="denom-label">${val}</div>
            <div class="denom-mul">X</div>
            <input type="number" class="form-control form-control-sm denom-input" id="x${val}" value="" 
                oninput="calculateTotal()" 
                onkeydown="handleDenomKey(event, ${index})">
            <div class="denom-equal">=</div>
            <input type="number" class="form-control form-control-sm denom-total" id="total${val}" readonly>
        `;
        container.appendChild(div);
    });
}

window.handleDenomKey = function (e, index) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const nextIndex = index + 1;
        if (nextIndex < denoms.length) {
            const nextVal = denoms[nextIndex];
            const nextInput = document.getElementById(`x${nextVal}`);
            if (nextInput) {
                nextInput.focus();
                nextInput.select(); // Optional: select content
            }
        } else {
            // Move to Expense
            const expenseInput = document.getElementById('expense');
            if (expenseInput) {
                expenseInput.focus();
                expenseInput.select();
            }
        }
    }
}

function calculateTotal() {
    let grandTotal = 0;

    denoms.forEach(val => {
        const input = document.getElementById(`x${val}`);
        const count = parseFloat(input.value) || 0;
        const total = count * val;
        document.getElementById(`total${val}`).value = total > 0 ? total : '';
        grandTotal += total;
    });

    const expense = parseFloat(document.getElementById('expense').value) || 0;
    grandTotal += expense;

    document.getElementById('grandTotal').value = grandTotal;
}

let editingId = null;
let currentList = [];

async function saveData() {
    const mode = document.getElementById('mode').value;
    const isBank = mode === 'Bank';

    const payload = {
        user: document.getElementById('user').value,
        date: document.getElementById('date').value,
        branch: document.getElementById('branch').value,
        mode: mode,
        department: document.getElementById('department').value,
        remarks: document.getElementById('remarks').value,
        batchNo: document.getElementById('batchNo').value,
    };

    if (isBank) {
        payload.bank = document.getElementById('bankSelect').value;
        payload.totalAmount = parseFloat(document.getElementById('bankAmount').value) || 0;
        payload.deductedAmount = parseFloat(document.getElementById('deductedAmount').value) || 0;
        payload.isDeduction = document.getElementById('deductionCheck').checked;

        if (!payload.bank) { alert('Select Bank'); return; }
        if (!payload.totalAmount) { alert('Enter Amount'); return; }
    } else {
        payload.slip = document.getElementById('slip').value;
        payload.bigCash = parseFloat(document.getElementById('bigCash').value) || 0;
        payload.expense = parseFloat(document.getElementById('expense').value) || 0;
        payload.totalAmount = parseFloat(document.getElementById('grandTotal').value) || 0;

        // Add denominations
        denoms.forEach(val => {
            payload[`x${val}`] = parseFloat(document.getElementById(`x${val}`).value) || 0;
        });
    }

    if (!payload.department) { alert('Select Department'); return; }

    try {
        const token = localStorage.getItem('token');
        let url = '/api/v1/daily-cash';
        let method = 'POST';

        if (editingId) {
            url += `/${editingId}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            alert(editingId ? 'Updated successfully' : 'Saved successfully');
            clearForm();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { console.error(e); }
}

function clearForm() {
    editingId = null;

    // Keep user, branch, date
    document.getElementById('department').value = '';
    document.getElementById('remarks').value = '';
    document.getElementById('batchNo').value = '';

    // Clear Cash fields
    document.getElementById('slip').value = '';
    document.getElementById('bigCash').value = '0';
    document.getElementById('expense').value = '0';
    denoms.forEach(val => {
        document.getElementById(`x${val}`).value = '';
        document.getElementById(`total${val}`).value = '';
    });
    calculateTotal();

    // Clear Bank fields
    document.getElementById('bankSelect').value = '';
    document.getElementById('bankAmount').value = '';
    document.getElementById('deductedAmount').value = '';
    document.getElementById('deductionCheck').checked = false;

    // Check mode to reset UI state if needed, but usually keep mode
}

function showList() {
    // Populate defaults
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('listFromDate').value = today;
    document.getElementById('listToDate').value = today;

    // Populate Branch
    const mainBranch = document.getElementById('branch').innerHTML;
    const listBranch = document.getElementById('listBranch');

    if (listBranch) {
        // Check User Logic
        const user = JSON.parse(localStorage.getItem('user')) || {};
        const userBranch = user.branch;

        if (!userBranch || userBranch === 'All Branches') {
            listBranch.innerHTML = '<option value="">All Branches</option>' + mainBranch;
        } else {
            // User is restricted, so 'All Branches' is not allowed. Just show their allowed branches.
            // Since 'mainBranch' options are already filtered by loadBranches(), we can just use that.
            // But we might need to remove "Select Branch" if it's there? No, usually fine.
            // Usually mainBranch has "Select Branch" as first option. 
            // If we just dump it, the list filter will have "Select Branch" which maps to value="" -> All Branches in backend?
            // Wait, empty value usually means "All" in filters.

            // If user is restricted to "F-6", we want the list to ONLY show "F-6".
            // The backend query `daily-cash?branch=F-6`.
            // If the select value is "F-6", it works.
            // If the select value is "" (Select Branch), the backend might return ALL.

            // We need to ensure the default selection is their branch.

            listBranch.innerHTML = mainBranch;
            // Remove "Select Branch" dummy option if present so they can't select "nothing" (which implies All)
            if (listBranch.options.length > 0 && listBranch.options[0].value === "") {
                listBranch.remove(0);
            }
        }
    }

    const modalEl = document.getElementById('listModal');
    // Use getOrCreateInstance to prevent duplicates
    if (window.bootstrap) {
        const listModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        listModal.show();
    } else {
        // Fallback or alert if bootstrap handling fails
        const listModal = new bootstrap.Modal(modalEl);
        listModal.show();
    }
    fetchDailyCashList();
}

async function fetchDailyCashList() {
    try {
        const token = localStorage.getItem('token');
        const fromDate = document.getElementById('listFromDate').value;
        const toDate = document.getElementById('listToDate').value;
        const branch = document.getElementById('listBranch').value;

        let url = `/api/v1/daily-cash?startDate=${fromDate}&endDate=${toDate}`;
        if (branch && branch !== 'All Branches') url += `&branch=${branch}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const tbody = document.getElementById('listBody');
        tbody.innerHTML = '';

        if (data.success && data.data) {
            currentList = data.data; // Store for editing
            data.data.forEach(item => {
                const tr = document.createElement('tr');

                // 1. Action Column (Created via DOM)
                const actionTd = document.createElement('td');
                const actionDiv = document.createElement('div');
                actionDiv.className = 'd-flex gap-1 justify-content-center';

                // Edit Button
                const btnEdit = document.createElement('button');
                btnEdit.className = 'btn btn-success btn-sm btn-square-sm';
                btnEdit.innerHTML = '<i class="fas fa-edit"></i>'; // Changed to icon only
                btnEdit.title = 'Edit'; // Added title
                btnEdit.type = 'button';
                btnEdit.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.handleEdit(item._id);
                });

                // Print Button
                const btnPrint = document.createElement('button');
                btnPrint.className = 'btn btn-primary btn-sm btn-square-sm';
                btnPrint.innerHTML = '<i class="fas fa-print"></i>'; // Changed to icon only
                btnPrint.title = 'Print'; // Added title
                btnPrint.type = 'button';
                btnPrint.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.handlePrint(item._id);
                });

                // Delete Button
                const btnDelete = document.createElement('button');
                btnDelete.className = 'btn btn-danger btn-sm btn-square-sm';
                btnDelete.innerHTML = '<i class="fas fa-trash"></i>'; // Changed to icon only
                btnDelete.title = 'Delete'; // Added title
                btnDelete.type = 'button';
                btnDelete.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.handleDelete(item._id);
                });

                actionDiv.appendChild(btnEdit);
                actionDiv.appendChild(btnPrint);
                actionDiv.appendChild(btnDelete);
                actionTd.appendChild(actionDiv);
                tr.appendChild(actionTd);

                // 2. Data Columns
                const dateStr = new Date(item.date).toLocaleDateString();
                const departmentName = item.department ? item.department.name : '-';

                // Append remaining columns safely
                tr.insertAdjacentHTML('beforeend', `
                    <td>${dateStr}</td>
                    <td>${item.mode}</td>
                    <td>${departmentName}</td>
                    <td>${item.branch}</td>
                    <td>${item.user || '-'}</td>
                    <td></td> <!-- Computer Name -->
                    <td>${item.x5000 || 0}</td>
                    <td>${item.x1000 || 0}</td>
                    <td>${item.x500 || 0}</td>
                    <td>${item.x100 || 0}</td>
                    <td>${item.x75 || 0}</td>
                    <td>${item.x50 || 0}</td>
                    <td>${item.x20 || 0}</td>
                    <td>${item.x10 || 0}</td>
                    <td>${item.x5 || 0}</td>
                    <td>${item.x2 || 0}</td>
                    <td>${item.x1 || 0}</td>
                    <td>${item.expense || 0}</td>
                    <td class="fw-bold">${item.totalAmount}</td>
                    <td>${item.slip || ''}</td>
                    <td>${item.bigCash || 0}</td>
                    <td>${item.batchNo || ''}</td>
                `);

                tbody.appendChild(tr);
            });
        }
    } catch (e) { console.error('Error fetching list:', e); }
}

window.handleEdit = async function (id) {
    console.log('Edit clicked for ID:', id);
    const item = currentList.find(r => r._id === id);
    if (!item) {
        console.error('Item not found in currentList');
        return;
    }

    // Proceeding directly without confirm to avoid blocking issues
    console.log('Proceeding to edit...');

    try {
        const modalEl = document.getElementById('listModal');
        if (window.bootstrap) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.hide();
        } else {
            // Fallback
            const modal = new bootstrap.Modal(modalEl);
            modal.hide();
        }
    } catch (e) { console.warn('Modal hide error:', e); }

    editingId = id;
    document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save"></i> Update';

    // Populate Form
    document.getElementById('branch').value = item.branch;
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = new Date(item.date).toISOString().split('T')[0];

    document.getElementById('mode').value = item.mode;
    toggleMode(); // Apply layout

    await loadDepartments();
    document.getElementById('department').value = item.department ? item.department._id : '';

    document.getElementById('remarks').value = item.remarks || '';
    document.getElementById('batchNo').value = item.batchNo || '';

    if (item.mode === 'Bank') {
        await loadBankList();
        document.getElementById('bankSelect').value = item.bank || '';
        document.getElementById('bankAmount').value = item.totalAmount || '';
        document.getElementById('deductedAmount').value = item.deductedAmount || '';
        document.getElementById('deductionCheck').checked = item.isDeduction;
    } else {
        document.getElementById('slip').value = item.slip || '';
        document.getElementById('bigCash').value = item.bigCash || 0;
        document.getElementById('expense').value = item.expense || 0;

        denoms.forEach(val => {
            document.getElementById(`x${val}`).value = item['x' + val] || '';
        });
        calculateTotal();
    }
}

let pendingDeleteId = null;

window.handleDelete = function (id) {
    console.log('Delete clicked for ID:', id);
    pendingDeleteId = id;
    const modalEl = document.getElementById('deleteModal');
    if (window.bootstrap) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Attach listener for modal confirmation
document.addEventListener('DOMContentLoaded', () => {
    // ... existing DOMContentLoaded code runs first ...

    // Attach to confirm delete button
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!pendingDeleteId) return;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/v1/daily-cash/${pendingDeleteId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                // Hide Modal
                const modalEl = document.getElementById('deleteModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();

                if (data.success) {
                    fetchDailyCashList();
                    alert('Deleted successfully');
                } else {
                    alert(data.message);
                }
            } catch (e) {
                console.error('Delete error', e);
                alert('Delete failed');
            }
        });
    }
});

window.handlePrint = function (id) {
    console.log('Print clicked for ID:', id);
    console.log('Print functionality initiated');
}
