let allBanks = [];
let allDepartments = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;

    // Load data
    await loadInitialData();

    // User info
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };
    document.getElementById('userNameDisplay').textContent = user.name;
    document.getElementById('userInitial').textContent = user.name.charAt(0).toUpperCase();
});

async function loadInitialData() {
    try {
        const token = localStorage.getItem('token');

        // 1. Load Stores (Branches)
        try {
            const storesResp = await fetch('/api/v1/stores', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const storesData = await storesResp.json();

            if (storesData.success) {
                const branchSelect = document.getElementById('branchSelect');
                branchSelect.innerHTML = '<option value="">All Branches</option>';

                storesData.data.forEach(store => {
                    const opt = document.createElement('option');
                    opt.value = store.name;
                    opt.textContent = store.name;
                    branchSelect.appendChild(opt);
                });
            }
        } catch (err) {
            console.error('Error loading stores:', err);
        }

        // 2. Load Banks
        const banksResp = await fetch('/api/v1/banks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const banksData = await banksResp.json();

        if (banksData.success) {
            allBanks = banksData.data;
            // Populate all banks initially
            populateBanks(allBanks);
        }

        // 3. Load Departments
        const deptResp = await fetch('/api/v1/departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const deptData = await deptResp.json();

        if (deptData.success) {
            allDepartments = deptData.data;
            populateDepartments(); // Initial population
        }

    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load initial data');
    }
}

function populateDepartments() {
    const selectedBranch = document.getElementById('branchSelect').value;
    const deptSelect = document.getElementById('departmentSelect');
    const currentVal = deptSelect.value;

    deptSelect.innerHTML = '<option value="">All Departments</option>';

    let filteredDepts = allDepartments;

    if (selectedBranch) {
        // Filter by Branch
        filteredDepts = filteredDepts.filter(d => d.branch === selectedBranch);

        // Filter: Must have at least one bank associated with this department AND branch
        filteredDepts = filteredDepts.filter(dept => {
            return allBanks.some(bank => {
                // Handle bank.department being ID string or object
                const bankDeptId = (bank.department && bank.department._id) ? bank.department._id : bank.department;
                return bankDeptId === dept._id && bank.branch === selectedBranch;
            });
        });
    }

    filteredDepts.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept._id;
        opt.textContent = dept.name;
        deptSelect.appendChild(opt);
    });

    // Restore selection if valid
    if (currentVal && Array.from(deptSelect.options).some(o => o.value === currentVal)) {
        deptSelect.value = currentVal;
    }
}

function handleBranchChange() {
    populateDepartments();
    filterBanks();
}

function filterBanks() {
    const selectedBranch = document.getElementById('branchSelect').value;
    const selectedDeptId = document.getElementById('departmentSelect').value;

    let filteredBanks = allBanks;

    // Filter by Branch (Store Name)
    if (selectedBranch) {
        filteredBanks = filteredBanks.filter(b => b.branch === selectedBranch);
    }

    // Filter by Department
    if (selectedDeptId) {
        filteredBanks = filteredBanks.filter(b => {
            const bDeptId = (b.department && b.department._id) ? b.department._id : b.department;
            return bDeptId === selectedDeptId;
        });
    }

    // Filter: Hide 'Branch Bank' type from this report
    filteredBanks = filteredBanks.filter(b => b.bankType !== 'Branch Bank');

    populateBanks(filteredBanks);
}

function populateBanks(banks) {
    const bankSelect = document.getElementById('bankSelect');
    bankSelect.innerHTML = '<option value="">Choose Bank...</option>';

    banks.sort((a, b) => a.bankName.localeCompare(b.bankName)).forEach(bank => {
        const opt = document.createElement('option');
        opt.value = bank._id;
        opt.textContent = bank.bankName;
        bankSelect.appendChild(opt);
    });
}

async function generateReport() {
    const bankId = document.getElementById('bankSelect').value;
    const branch = document.getElementById('branchSelect').value;
    const departmentId = document.getElementById('departmentSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const startInvDate = document.getElementById('startInvDate').value;
    const endInvDate = document.getElementById('endInvDate').value;

    if (!bankId) {
        alert('Please select a bank');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        let url = `/api/v1/reports/bank-ledger?bankId=${bankId}&startDate=${startDate}&endDate=${endDate}`;
        if (branch) url += `&branch=${encodeURIComponent(branch)}`;
        if (departmentId) url += `&departmentId=${departmentId}`;
        if (startInvDate) url += `&startInvDate=${startInvDate}`;
        if (endInvDate) url += `&endInvDate=${endInvDate}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            renderReport(data.data, startDate, endDate);
        } else {
            alert(data.message || 'Failed to generate report');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while generating the report');
    }
}

function renderReport(data, startDate, endDate) {
    // Show report area
    document.getElementById('reportArea').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';

    // Header
    document.getElementById('bankName').textContent = data.bankName;
    document.getElementById('branchName').textContent = data.branch || 'All Branches';
    document.getElementById('dateRange').textContent = `${startDate} to ${endDate}`;
    document.getElementById('openingBalance').textContent = formatCurrency(data.openingBalance);

    // Update Print Header
    if (document.getElementById('printBranchName')) document.getElementById('printBranchName').textContent = data.branch || 'All Branches';
    if (document.getElementById('printDateRange')) document.getElementById('printDateRange').textContent = `${startDate} to ${endDate}`;
    if (document.getElementById('printReportTitle')) document.getElementById('printReportTitle').textContent = `Bank Ledger - ${data.bankName}`;

    // Stats
    document.getElementById('totalDebit').textContent = formatCurrency(data.totalDebit);
    document.getElementById('totalCredit').textContent = formatCurrency(data.totalCredit);
    document.getElementById('closingBalance').textContent = formatCurrency(data.closingBalance);

    // Table
    const tbody = document.getElementById('ledgerBody');
    tbody.innerHTML = '';

    // Opening balance row
    const openingRow = document.createElement('tr');
    openingRow.className = 'table-light fw-bold';
    openingRow.innerHTML = `
        <td>${startDate}</td>
        <td colspan="5">Opening Balance</td>
        <td class="text-end">-</td>
        <td class="text-end">-</td>
        <td class="text-end">${formatCurrency(data.openingBalance)}</td>
    `;
    tbody.appendChild(openingRow);

    // Transaction rows
    data.transactions.forEach(tx => {
        const row = document.createElement('tr');
        const date = new Date(tx.date).toISOString().split('T')[0];
        const invDate = tx.invoiceDate ? new Date(tx.invoiceDate).toISOString().split('T')[0] : '-';

        let typeBadge = '';
        if (tx.type === 'Daily Cash') typeBadge = '<span class="badge bg-info badge-type">Daily Cash</span>';
        else if (tx.type === 'Bank Receipt') typeBadge = '<span class="badge bg-success badge-type">Receipt</span>';
        else if (tx.type === 'Bank Payment') typeBadge = '<span class="badge bg-danger badge-type">Payment</span>';
        else if (tx.type === 'Bank Transfer') typeBadge = '<span class="badge bg-warning badge-type">Transfer</span>';

        let remarksHtml = '';
        if (tx.remarks === 'Batch Transfered') {
            remarksHtml = `<div class="fw-bold text-success mt-1" style="font-size: 0.9rem;">${tx.remarks}</div>`;
        } else if (tx.remarks) {
            // If Daily Cash and NOT 'Batch Transfered', hide remarks as per request
            if (tx.type === 'Daily Cash') {
                remarksHtml = '';
            } else {
                remarksHtml = `<small class="text-muted d-block mt-1">${tx.remarks}</small>`;
            }
        }

        row.innerHTML = `
            <td>${date}</td>
            <td>
                <div class="fw-bold">${tx.narration}</div>
                ${remarksHtml}
            </td>
            <td>${typeBadge}</td>
            <td>${tx.batchNo}</td>
            <td>${invDate}</td>
            <td>${tx.department}</td>
            <td class="text-end amount-debit">${tx.debit > 0 ? formatCurrency(tx.debit) : '-'}</td>
            <td class="text-end amount-credit">${tx.credit > 0 ? formatCurrency(tx.credit) : '-'}</td>
            <td class="text-end fw-bold">${formatCurrency(tx.balance)}</td>
        `;
        tbody.appendChild(row);
    });

    // Footer
    document.getElementById('footerDebit').textContent = formatCurrency(data.totalDebit);
    document.getElementById('footerCredit').textContent = formatCurrency(data.totalCredit);
    document.getElementById('footerBalance').textContent = formatCurrency(data.closingBalance);
}

function formatCurrency(amount) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
