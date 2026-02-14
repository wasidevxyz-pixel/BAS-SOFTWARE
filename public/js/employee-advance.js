let advances = [];
let employees = [];
let currentBranchEmployees = [];
let currentInstallmentData = {
    preMonthInstallment: { preBal: 0, installment: 0, balance: 0 },
    currentMonthInstallment: { preBal: 0, installment: 0, balance: 0 }
};
let currentEmployeeSearchIndex = -1;
let pendingAction = null; // 'edit' or 'delete'
let pendingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDate();

    // Auth Modal Enter Key Listener
    document.getElementById('authPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') confirmModification();
    });
    await loadDepartments(); // Load departments
    await loadEmployees(); // Load data first
    await loadBranches();  // Then render branches (might trigger filter)
    loadAdvances();

    // Search functionality
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = advances.filter(adv =>
            adv.employee?.name?.toLowerCase().includes(searchTerm) ||
            adv.branch?.toLowerCase().includes(searchTerm)
        );
        renderTable(filtered);
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();

            const modal = document.getElementById('installmentModal');
            if (modal && modal.classList.contains('show')) { // Bootstrap adds 'show' class when open
                saveInstallment();
            } else {
                saveAdvance();
            }
        }
    });
});

async function loadDepartments() {
    try {
        const token = localStorage.getItem('token');
        // Use the correct API endpoint matching Employee Registration
        const response = await fetch('/api/v1/employee-departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('department');
            // Keep "Select Department"
            select.innerHTML = '<option value="">Select Department</option>';
            const depts = data.data; // Assuming this API returns departments directly in data.data
            depts.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept._id;
                option.textContent = dept.name;
                select.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Error loading departments:', e);
    }
}

function setDefaultDate() {
    // Use Local Date instead of UTC ISO string to avoid midnight shifts
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localToday = `${year}-${month}-${day}`;

    // Main Form Date
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = localToday;

    // Search Filters Date
    const fromDate = document.getElementById('searchFromDate');
    const toDate = document.getElementById('searchToDate');
    if (fromDate) fromDate.value = localToday;
    if (toDate) toDate.value = localToday;

    // Update balances when date changes
    dateInput?.addEventListener('change', loadEmployeeBalance);
}

async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            // Store all employees but don't render yet
            employees = data.data.filter(emp => emp.isActive && emp.allowEmployeeAdvance);
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

// Duplicate function removed (defined correctly below)


function clearForm() {
    document.getElementById('advanceId').value = '';

    // Clear Employee Input
    const empInput = document.getElementById('employeeInput');
    if (empInput) empInput.value = '';

    setDefaultDate();
    document.getElementById('branch').value = '';
    document.getElementById('department').value = ''; // Clear department
    document.getElementById('transactionType').value = 'Pay'; // Reset transaction type
    document.getElementById('code').value = '';
    document.getElementById('preMonthBal').value = '0';
    document.getElementById('currentMonthBal').value = '0';
    document.getElementById('total').value = '0';
    document.getElementById('salary').value = '0';
    document.getElementById('paid').value = '0';
    document.getElementById('balance').value = '0';
    document.getElementById('docMode').value = 'Cash';
    document.getElementById('remarks').value = '';

    currentInstallmentData = {
        preMonthInstallment: { preBal: 0, installment: 0, balance: 0 },
        currentMonthInstallment: { preBal: 0, installment: 0, balance: 0 }
    };
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
            select.innerHTML = '<option value="">Select Branch</option>';
            data.data.forEach(store => {
                const option = document.createElement('option');
                option.value = store.name;
                option.textContent = store.name;
                select.appendChild(option);
            });
            if (data.data.length === 1) {
                select.value = data.data[0].name;
                filterEmployees(); // Trigger filter if auto-selected
            }
        }
    } catch (e) {
        console.error('Error loading branches:', e);
    }
}

// Duplicate function removed (defined correctly below)


function calculateTotals() {
    const preMonthBal = parseFloat(document.getElementById('preMonthBal').value) || 0;
    const currentMonthBal = parseFloat(document.getElementById('currentMonthBal').value) || 0;
    let amount = parseFloat(document.getElementById('paid').value) || 0;
    const salary = parseFloat(document.getElementById('salary').value) || 0;
    const type = document.getElementById('transactionType').value;

    // Permission Check: Allow Adv More Than Salary (right_01)
    if (type === 'Pay' && amount > salary && salary > 0) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const rights = user.rights || {};
        const permissions = user.permissions || [];
        // Strictly follow the checkbox even for admins
        const canExceed = rights['right_01'] || permissions.includes('right_01');

        if (!canExceed) {
            alert(`Accedd Denied: Advance amount (${amount.toLocaleString()}) cannot exceed basic salary (${salary.toLocaleString()}).`);
            amount = salary;
            document.getElementById('paid').value = salary;
        }
    }

    // Total = Liability Before This Transaction
    // Pre Month Bal + (Current Month Accumulated Changes)
    const total = preMonthBal + currentMonthBal;

    // Balance = Total +/- Amount
    let balance = 0;
    if (type === 'Received') {
        balance = total - amount; // Reducing liability
    } else {
        balance = total + amount; // Increasing liability (Advance)
    }

    document.getElementById('total').value = total;
    document.getElementById('balance').value = balance;
}

async function loadAdvances() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-advances', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            advances = data.data;

            // Apply Date Filter if set
            const fromDate = document.getElementById('searchFromDate').value;
            const toDate = document.getElementById('searchToDate').value;

            let filtered = advances;
            if (fromDate && toDate) {
                // Use strict date-part comparison to avoid timezone shifts
                filtered = advances.filter(adv => {
                    const advDateStr = adv.date ? new Date(adv.date).toISOString().split('T')[0] : '';
                    return advDateStr >= fromDate && advDateStr <= toDate;
                });
            }

            renderTable(filtered);
        }
    } catch (error) {
        console.error('Error loading advances:', error);
        alert('Error loading advances');
    }
}

function renderTable(data) {
    const tbody = document.getElementById('advanceBody');
    tbody.innerHTML = '';

    let totalAmount = 0;

    data.forEach(adv => {
        const amount = parseFloat(adv.paid) || 0;
        if (Math.abs(amount) < 0.01) return;

        // Ledger sum: Subtract Received, Add Paid
        if (adv.transactionType === 'Received') {
            totalAmount -= amount;
        } else {
            totalAmount += amount;
        }
        // Date display: Use raw date part to avoid +1 day shifts at midnight
        const ds = adv.date ? new Date(adv.date).toISOString().split('T')[0] : '';
        const dateStr = ds ? ds.split('-').reverse().join('/') : '-';
        const timeStr = adv.createdAt ? new Date(adv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const rights = user.rights || {};
        const permissions = user.permissions || [];
        // Strictly follow mod_12 even for admins
        const canModify = rights['mod_12'] || permissions.includes('mod_12');

        const updateDate = adv.updatedAt ? new Date(adv.updatedAt).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('/') : '-';
        const updateTime = adv.updatedAt ? new Date(adv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
        const modifiedBy = adv.updatedBy?.name || '-';

        const tr = document.createElement('tr');
        if (adv.transactionType === 'Received') {
            tr.style.backgroundColor = '#d4edda'; // Light Green
        } else {
            tr.style.backgroundColor = '#f8d7da'; // Light Red/Pink
        }

        tr.innerHTML = `
            <td style="background-color: inherit !important;">${dateStr}</td>
            <td style="background-color: inherit !important;">${timeStr}</td>
            <td style="background-color: inherit !important;">${adv.employee?.name || '-'}</td>
            <td style="background-color: inherit !important;">${adv.transactionType === 'Received' ? 'Received' : 'Paid'}</td> <!-- Type -->
            <td style="background-color: inherit !important;">${amount}</td>
            <td style="background-color: inherit !important;">${adv.docMode || 'Cash'}</td>
            <td style="background-color: inherit !important;">${adv.docMode === 'Bank' ? (adv.bankName || '-') : '-'}</td> <!-- Bank Name -->
            <td style="background-color: inherit !important;">${adv.createdBy?.name || '-'}</td> <!-- User Name -->
            <td style="background-color: inherit !important;">${modifiedBy}</td>
            <td style="background-color: inherit !important;">${modifiedBy !== '-' ? `${updateDate} ${updateTime}` : '-'}</td>
            <td style="background-color: inherit !important;">${adv.remarks || '-'}</td>
            <td style="background-color: inherit !important;">
                <div class="d-flex">
                    <button class="btn-action-sm btn-action-view" onclick="printSlip('${adv._id}')" title="Print Slip"><i class="fas fa-print"></i></button>
                    ${canModify ? `<button class="btn-action-sm btn-action-edit" onclick="editAdvance('${adv._id}')" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
                    ${canModify ? `<button class="btn-action-sm btn-action-delete" onclick="deleteAdvance('${adv._id}')" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add Total Row
    if (data.length > 0) {
        const totalTr = document.createElement('tr');
        totalTr.style.backgroundColor = '#2c5ba9'; // BAS Blue
        totalTr.style.color = 'white';
        totalTr.style.fontWeight = 'bold';

        totalTr.innerHTML = `
            <td colspan="4" class="text-end" style="background-color: #2c5ba9 !important; color: white !important;">Total</td>
            <td style="background-color: #2c5ba9 !important; color: white !important;">${totalAmount.toLocaleString()}</td>
            <td colspan="7" style="background-color: #2c5ba9 !important;"></td>
        `;
        tbody.appendChild(totalTr);
    }
}

async function printSlip(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-advances/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const adv = data.data;
            const empName = adv.employee ? `${adv.employee.name}` : '-';
            const deptName = adv.department ? adv.department.name : (adv.employee?.department?.name || '-');
            const desigName = adv.employee?.designation?.name || '-';
            const dateStr = adv.date ? new Date(adv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

            // Amount
            const amount = adv.paid || 0;
            const preBal = adv.total || 0; // Assuming 'total' was the balance before this transaction as per calculation logic

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Advance Payment Slip</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; padding: 20px; }
                        .container { width: 800px; margin: 0 auto; border: 1px solid #000; padding: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .title { font-size: 24px; font-weight: bold; margin: 5px 0; }
                        .subtitle { font-size: 14px; }
                        .slip-title { font-size: 18px; font-weight: bold; text-decoration: underline; margin-top: 10px; }
                        
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        td { border: 1px solid #000; padding: 8px; vertical-align: middle; }
                        .label-col { width: 30%; font-weight: bold; }
                        .value-col { width: 70%; font-weight: bold; }
                        
                        .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                        .sig-box { text-align: center; width: 30%; }
                        .sig-line { border-top: 1px solid #000; margin-bottom: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="title">Dwatson</div>
                            <div class="subtitle">Islamabad</div>
                            <div class="subtitle">051-5895662, 1234567</div>
                            <div class="slip-title">Advance Payment Slip</div>
                        </div>
                        
                        <table>
                            <tr>
                                <td class="label-col">Dated</td>
                                <td class="value-col">${dateStr}</td>
                            </tr>
                            <tr>
                                <td class="label-col">Employee</td>
                                <td class="value-col">${empName}</td>
                            </tr>
                            <tr>
                                <td class="label-col">Pre Balance</td>
                                <td class="value-col">${preBal.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td class="label-col">Current Advance Paid</td>
                                <td class="value-col">${amount.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td class="label-col">Department</td>
                                <td class="value-col">${deptName}</td>
                            </tr>
                            <tr>
                                <td class="label-col">Designation</td>
                                <td class="value-col">${desigName}</td>
                            </tr>
                            <tr>
                                <td class="label-col">Remarks</td>
                                <td class="value-col">${adv.remarks || ''}</td>
                            </tr>
                            <tr style="font-size: 12px; color: #555;">
                                <td class="label-col">Prepared By</td>
                                <td class="value-col">${adv.createdBy?.name || '-'}</td>
                            </tr>
                            ${adv.updatedBy ? `
                            <tr style="font-size: 12px; color: #555;">
                                <td class="label-col">Modified By</td>
                                <td class="value-col">${adv.updatedBy.name || '-'} (${new Date(adv.updatedAt).toLocaleString()})</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <div class="signatures">
                            <div class="sig-box">
                                <div class="sig-line"></div>
                                <div>Prepared By Signature</div>
                            </div>
                            <div class="sig-box">
                                <div class="sig-line"></div>
                                <div>Received By Signature</div>
                            </div>
                            <div class="sig-box">
                                <div class="sig-line"></div>
                                <div>Approved By Signature</div>
                            </div>
                        </div>
                    </div>
                    <script>
                        window.print();
                        window.onafterprint = function() { window.close(); }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    } catch (e) {
        console.error('Error printing slip:', e);
        alert('Error generating print slip');
    }
}

async function saveAdvance(customSuccessMsg = null) {
    const advanceId = document.getElementById('advanceId').value;
    // Get ID from global map or hidden input if using datalist
    // Since we switched to datalist, 'employee' element might be the input or we need a hidden one.
    // I'll assume we use a mapping or check the input value against employees list.

    // Logic for DataList ID retrieval:
    const empInputVal = document.getElementById('employeeInput').value;
    const selectedEmp = employees.find(e => `${e.code} - ${e.name}` === empInputVal);
    const empId = selectedEmp ? selectedEmp._id : '';

    const deptValue = document.getElementById('department').value;
    const advanceData = {
        employee: empId,
        date: document.getElementById('date').value,
        branch: document.getElementById('branch').value,
        department: deptValue || null,
        transactionType: document.getElementById('transactionType').value,
        code: document.getElementById('code').value,
        preMonthBal: parseFloat(document.getElementById('preMonthBal').value) || 0,
        currentMonthBal: parseFloat(document.getElementById('currentMonthBal').value) || 0,
        total: parseFloat(document.getElementById('total').value) || 0,
        salary: parseFloat(document.getElementById('salary').value) || 0,
        paid: parseFloat(document.getElementById('paid').value) || 0,
        balance: parseFloat(document.getElementById('balance').value) || 0,
        docMode: document.getElementById('docMode').value,
        remarks: document.getElementById('remarks').value,
        preMonthInstallment: currentInstallmentData.preMonthInstallment,
        currentMonthInstallment: currentInstallmentData.currentMonthInstallment
    };

    if (!advanceData.employee || !advanceData.date) {
        alert('Please select employee and date');
        return;
    }

    // Extra safety check before saving
    if (advanceData.transactionType === 'Pay' && advanceData.paid > advanceData.salary && advanceData.salary > 0) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const rights = user.rights || {};
        const permissions = user.permissions || [];
        // Strictly follow the checkbox even for admins
        const canExceed = rights['right_01'] || permissions.includes('right_01');

        if (!canExceed) {
            alert(`Access Denied: Advance amount cannot exceed basic salary (${advanceData.salary.toLocaleString()}).`);
            return;
        }
    }

    try {
        const token = localStorage.getItem('token');
        const url = advanceId ? `/api/v1/employee-advances/${advanceId}` : '/api/v1/employee-advances';
        const method = advanceId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(advanceData)
        });

        const data = await response.json();

        if (data.success) {
            alert(customSuccessMsg || (advanceId ? 'Advance updated successfully' : 'Advance created successfully'));

            if (customSuccessMsg) {
                // Save from Installment Modal: Refresh summaries without clearing employee
                await loadAdvances();
                await loadEmployeeBalance();
            } else {
                // Regular Save: FULL form reset for the next entry
                clearForm();
                await loadAdvances();
            }
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error saving advance:', error);
        alert('Error saving advance');
    }
}

// ... (Search Listeners will be removed/updated in next chunk or implicitly replaced by this file content)

// ...

async function saveInstallment() {
    const inst1 = parseFloat(document.getElementById('modalInstallment1').value) || 0;
    const inst2 = parseFloat(document.getElementById('modalInstallment2').value) || 0;
    const bal1 = parseFloat(document.getElementById('modalBalance1').value) || 0;
    const bal2 = parseFloat(document.getElementById('modalBalance2').value) || 0;

    if (bal1 < 0 || bal2 < 0) {
        alert('Negative Balance is not allowed. Please check Installment Amount.');
        return;
    }

    // Explicitly update global before save
    currentInstallmentData.preMonthInstallment = {
        preBal: parseFloat(document.getElementById('modalPreBal1').value) || 0,
        installment: inst1,
        balance: bal1
    };

    currentInstallmentData.currentMonthInstallment = {
        preBal: parseFloat(document.getElementById('modalPreBal2').value) || 0,
        installment: inst2,
        balance: bal2
    };

    // CLOSE MODAL FIRST to avoid multiple clicks
    const modalEl = document.getElementById('installmentModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Persist and FORCE blocking refresh
    await saveAdvance('Installment Plan Updated Successfully');
}

// Search Listeners & Logic
document.addEventListener('DOMContentLoaded', () => {
    // Code Manual Entry
    document.getElementById('code').addEventListener('change', function () {
        const code = this.value.trim();
        if (!code) return;

        const emp = employees.find(e => e.code == code);
        if (emp) {
            const branchSelect = document.getElementById('branch');
            if (emp.branch !== branchSelect.value) {
                branchSelect.value = emp.branch;
                filterEmployees();
            }

            // Set Datalist Input value
            const input = document.getElementById('employeeInput');
            input.value = `${emp.code} - ${emp.name}`;
            loadEmployeeBalance(); // Trigger load

            // Move cursor to Paid column
            const paidInput = document.getElementById('paid');
            if (paidInput) {
                setTimeout(() => {
                    paidInput.focus();
                    paidInput.select();
                }, 100);
            }
        } else {
            alert('Employee with Code ' + code + ' not found.');
        }
    });

    // Employee Input Change (Datalist selection)
    // Employee Input Search Logic (Custom Dropdown)
    const empInput = document.getElementById('employeeInput');
    const resultsBox = document.getElementById('employeeSearchResults');

    if (empInput) {
        empInput.addEventListener('input', function () {
            const term = this.value.toLowerCase();
            resultsBox.innerHTML = '';
            resultsBox.style.display = 'none';
            currentEmployeeSearchIndex = -1;

            if (term.length >= 1) {
                const matches = currentBranchEmployees.filter(emp =>
                    emp.name.toLowerCase().includes(term) ||
                    emp.code.toString().includes(term)
                ).slice(0, 20); // Show top 20

                if (matches.length > 0) {
                    matches.forEach((emp, index) => {
                        const el = document.createElement('a');
                        el.className = 'list-group-item list-group-item-action p-2 small';
                        el.href = '#';
                        el.innerHTML = `<b>${emp.code}</b> - ${emp.name}`;
                        el.onclick = (e) => {
                            e.preventDefault();
                            selectEmployee(emp);
                        };
                        resultsBox.appendChild(el);
                    });
                    resultsBox.style.display = 'block';
                    resultsBox.matchedEmployees = matches;
                }
            }

            if (!this.value) {
                document.getElementById('code').value = '';
            }
        });

        empInput.addEventListener('keydown', (e) => {
            if (resultsBox.style.display === 'none') return;
            const items = resultsBox.querySelectorAll('.list-group-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentEmployeeSearchIndex = (currentEmployeeSearchIndex < items.length - 1) ? currentEmployeeSearchIndex + 1 : currentEmployeeSearchIndex;
                updateEmployeeSearchSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentEmployeeSearchIndex = (currentEmployeeSearchIndex > 0) ? currentEmployeeSearchIndex - 1 : currentEmployeeSearchIndex;
                updateEmployeeSearchSelection(items);
            } else if (e.key === 'Enter' && currentEmployeeSearchIndex >= 0) {
                e.preventDefault();
                const selectedEmp = resultsBox.matchedEmployees[currentEmployeeSearchIndex];
                if (selectedEmp) selectEmployee(selectedEmp);
            } else if (e.key === 'Escape') {
                resultsBox.style.display = 'none';
            }
        });
    }

    // Global click listener to hide suggestions
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.position-relative')) {
            resultsBox.style.display = 'none';
        }
    });
});

function updateEmployeeSearchSelection(items) {
    items.forEach(item => item.classList.remove('active'));
    if (currentEmployeeSearchIndex >= 0 && currentEmployeeSearchIndex < items.length) {
        items[currentEmployeeSearchIndex].classList.add('active');
        items[currentEmployeeSearchIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function selectEmployee(emp) {
    const empInput = document.getElementById('employeeInput');
    const resultsBox = document.getElementById('employeeSearchResults');
    empInput.value = `${emp.code} - ${emp.name}`;
    resultsBox.style.display = 'none';

    // CRITICAL: Clear current ID and any previous values so we start a NEW transaction
    document.getElementById('advanceId').value = '';
    document.getElementById('paid').value = 0;
    document.getElementById('remarks').value = '';

    loadEmployeeBalance(); // Load summaries

    // Automatically move cursor to Paid column
    const paidInput = document.getElementById('paid');
    if (paidInput) {
        setTimeout(() => {
            paidInput.focus();
            paidInput.select();
        }, 100);
    }
}

function filterEmployees() {
    const branchSelect = document.getElementById('branch');
    const selectedBranch = branchSelect.value;
    const resultsBox = document.getElementById('employeeSearchResults');
    const empInput = document.getElementById('employeeInput');

    // Clear previous options/search
    if (resultsBox) {
        resultsBox.innerHTML = '';
        resultsBox.style.display = 'none';
    }
    empInput.value = ''; // Reset selection on branch change

    if (!selectedBranch) {
        currentBranchEmployees = [];
        renderTable(advances);
        return;
    }

    // Filter employees by branch and store in global variable
    currentBranchEmployees = employees.filter(emp => emp.branch === selectedBranch);

    // Filter List by Branch AND Date
    const fromDate = document.getElementById('searchFromDate').value;
    const toDate = document.getElementById('searchToDate').value;

    const filteredAdvances = advances.filter(adv => {
        const isSameBranch = adv.branch === selectedBranch;

        // Date Logic (Sync with loadAdvances)
        const advDateStr = adv.date ? new Date(adv.date).toISOString().split('T')[0] : '';
        const isWithinDate = (fromDate && toDate) ? (advDateStr >= fromDate && advDateStr <= toDate) : true;

        return isSameBranch && isWithinDate;
    });
    renderTable(filteredAdvances);
}

async function loadEmployeeBalance() {
    const empInputVal = document.getElementById('employeeInput').value.trim();
    if (!empInputVal) return;

    // 1. Try Exact Match (Datalist selection)
    let selectedEmp = employees.find(e => `${e.code} - ${e.name}` === empInputVal);

    // 2. If no exact match, try to find by Code or Name strictly
    if (!selectedEmp) {
        const branchSelect = document.getElementById('branch');
        const selectedBranch = branchSelect.value;
        // Search candidates in current branch
        const candidates = employees.filter(emp => emp.branch === selectedBranch);

        const matches = candidates.filter(e =>
            e.code.toString() === empInputVal ||
            e.name.toLowerCase() === empInputVal.toLowerCase() ||
            // Check if user typed "First Last" and it matches
            e.name.toLowerCase().includes(empInputVal.toLowerCase())
        );

        if (matches.length === 1) {
            selectedEmp = matches[0];
            // Auto-update input to full format
            document.getElementById('employeeInput').value = `${selectedEmp.code} - ${selectedEmp.name}`;
        } else if (matches.length > 1) {
            // If multiple fuzzy matches, prefer exact name match
            const exactName = matches.find(e => e.name.toLowerCase() === empInputVal.toLowerCase());
            if (exactName) {
                selectedEmp = exactName;
                document.getElementById('employeeInput').value = `${selectedEmp.code} - ${selectedEmp.name}`;
            }
        }
    }

    // Reset installment data fully
    currentInstallmentData = {
        preMonthInstallment: { preBal: 0, installment: 0, balance: 0 },
        currentMonthInstallment: { preBal: 0, installment: 0, balance: 0 },
        isFromHistory: false
    };

    if (selectedEmp) {
        document.getElementById('code').value = selectedEmp.code || '';
        document.getElementById('salary').value = selectedEmp.basicSalary || 0;

        // Auto-populate department from employee record
        if (selectedEmp.department) {
            const deptId = typeof selectedEmp.department === 'object' ? selectedEmp.department._id : selectedEmp.department;
            document.getElementById('department').value = deptId;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/v1/employee-advances?employee=${selectedEmp._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                const advs = data.data;
                // STABLE SORT: Absolute temporal order
                advs.sort((a, b) => {
                    const t1 = new Date(a.date).getTime();
                    const t2 = new Date(b.date).getTime();
                    if (t1 !== t2) return t1 - t2;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                });

                const dateVal = document.getElementById('date').value;
                const selectedDate = dateVal ? new Date(dateVal) : new Date();
                const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                // --- DYNAMIC BALANCE CALCULATION (Running Total Logic) ---
                const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
                const advanceId = document.getElementById('advanceId').value;

                // Reset specific fields for a new entry if we are NOT in edit mode
                if (!advanceId) {
                    document.getElementById('paid').value = 0;
                    document.getElementById('remarks').value = '';
                }

                // Calculate Starting Balance for this Month (Closing balance of last month)
                const sYear = selectedDate.getFullYear();
                const sMonth = selectedDate.getMonth() + 1;
                const selMonthPrefix = `${sYear}-${sMonth.toString().padStart(2, '0')}`;

                const prevMonthAdvs = advs.filter(a => {
                    const d = new Date(a.date);
                    const aYear = d.getFullYear();
                    const aMonth = d.getMonth() + 1;
                    const aMonthPrefix = `${aYear}-${aMonth.toString().padStart(2, '0')}`;
                    return aMonthPrefix < selMonthPrefix;
                });
                const lastPrevAdv = prevMonthAdvs.length > 0 ? prevMonthAdvs[prevMonthAdvs.length - 1] : null;
                const preBal = lastPrevAdv ? (lastPrevAdv.balance || 0) : 0;

                // Calculate Net Change in Current Month (History)
                const currentMonthHistory = advs.filter(a => {
                    const d = new Date(a.date);
                    const aYear = d.getFullYear();
                    const aMonth = d.getMonth() + 1;
                    const aMonthPrefix = `${aYear}-${aMonth.toString().padStart(2, '0')}`;

                    const isSameMonth = aMonthPrefix === selMonthPrefix;
                    const isOtherRecord = advanceId ? (a._id !== advanceId) : true;
                    return isSameMonth && isOtherRecord;
                });

                let accumulatedChange = 0;
                currentMonthHistory.forEach(a => {
                    const amt = a.paid || 0;
                    if (a.transactionType === 'Received') {
                        accumulatedChange -= amt;
                    } else {
                        accumulatedChange += amt;
                    }
                });

                document.getElementById('preMonthBal').value = preBal;
                document.getElementById('currentMonthBal').value = accumulatedChange.toFixed(2);

                // 1. Find the ABSOLUTE LATEST record for this month (Using _id for definitive sequence)
                const selYear = selectedDate.getFullYear();
                const selMonth = selectedDate.getMonth();

                // First, filter for THIS month
                const monthHistory = advs.filter(a => {
                    const d = new Date(a.date);
                    return d.getFullYear() === selYear && d.getMonth() === selMonth;
                });

                // Pick the one with the highest _id (absolute latest creation)
                const recordInMonth = monthHistory.sort((a, b) => b._id.localeCompare(a._id))[0];

                if (recordInMonth) {
                    currentInstallmentData = {
                        preMonthInstallment: {
                            preBal: recordInMonth.preMonthInstallment?.preBal ?? preBal,
                            installment: recordInMonth.preMonthInstallment?.installment ?? preBal,
                            balance: recordInMonth.preMonthInstallment?.balance ?? 0
                        },
                        currentMonthInstallment: {
                            preBal: recordInMonth.currentMonthInstallment?.preBal ?? accumulatedChange,
                            installment: recordInMonth.currentMonthInstallment?.installment ?? accumulatedChange,
                            balance: recordInMonth.currentMonthInstallment?.balance ?? 0
                        },
                        isFromHistory: true
                    };
                } else {
                    currentInstallmentData = {
                        preMonthInstallment: { preBal: preBal, installment: preBal, balance: 0 },
                        currentMonthInstallment: { preBal: accumulatedChange, installment: accumulatedChange, balance: 0 },
                        isFromHistory: false
                    };
                }
                // --- END DYNAMIC CALCULATION ---
            } else {
                document.getElementById('preMonthBal').value = 0;
                document.getElementById('currentMonthBal').value = 0;
            }

            calculateTotals();
        } catch (error) {
            console.error('Error loading balance:', error);
            document.getElementById('preMonthBal').value = 0;
            document.getElementById('currentMonthBal').value = 0;
        }
    } else {
        // Clear if invalid selection
        document.getElementById('code').value = '';
        document.getElementById('salary').value = 0;
        document.getElementById('preMonthBal').value = 0;
        document.getElementById('currentMonthBal').value = 0;
        calculateTotals();
    }
}

async function editAdvance(id) {
    pendingId = id;
    pendingAction = 'edit';

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('authUsername').value = user.name || 'User';
    document.getElementById('authPassword').value = '';

    const authModal = new bootstrap.Modal(document.getElementById('authModal'));
    authModal.show();
}

async function executeEdit(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-advances/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const adv = data.data;
            document.getElementById('advanceId').value = adv._id;
            document.getElementById('date').value = adv.date ? adv.date.split('T')[0] : '';
            document.getElementById('department').value = adv.department || '';
            document.getElementById('transactionType').value = adv.transactionType || 'Pay';

            // Set Branch and trigger filter
            document.getElementById('branch').value = adv.branch || '';
            filterEmployees();

            // Set Employee (after filter)
            if (adv.employee) {
                const empInput = document.getElementById('employeeInput');
                empInput.value = `${adv.employee.code} - ${adv.employee.name}`; // Set value for datalist input
                // No need to set hidden ID if we look up by name matches in saveAdvance
            }

            document.getElementById('code').value = adv.code || '';
            document.getElementById('preMonthBal').value = adv.preMonthBal || 0;
            document.getElementById('currentMonthBal').value = adv.currentMonthBal || 0;
            document.getElementById('total').value = adv.total || 0;
            document.getElementById('salary').value = adv.salary || 0;
            document.getElementById('paid').value = adv.paid || 0;
            document.getElementById('balance').value = adv.balance || 0;
            document.getElementById('docMode').value = adv.docMode || 'Cash';
            document.getElementById('remarks').value = adv.remarks || '';

            // Load installment data
            currentInstallmentData = {
                preMonthInstallment: adv.preMonthInstallment || { preBal: 0, installment: 0, balance: 0 },
                currentMonthInstallment: adv.currentMonthInstallment || { preBal: 0, installment: 0, balance: 0 }
            };

            calculateTotals();
        }
    } catch (error) {
        console.error('Error loading advance:', error);
        alert('Error loading advance');
    }
}

async function deleteAdvance(id) {
    pendingId = id;
    pendingAction = 'delete';

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('authUsername').value = user.name || 'User';
    document.getElementById('authPassword').value = '';

    const authModal = new bootstrap.Modal(document.getElementById('authModal'));
    authModal.show();
}

async function executeDelete(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-advances/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            alert('Advance deleted successfully');
            loadAdvances();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting advance:', error);
        alert('Error deleting advance');
    }
}

async function confirmModification() {
    const password = document.getElementById('authPassword').value;
    if (!password) {
        alert('Please enter password');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    try {
        // Verify Password via Login API
        const verifyRes = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: password })
        });

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.token) {
            alert('Invalid Password');
            return;
        }

        // Final permission check
        const currentUser = verifyData.user || user;
        const currentRights = currentUser.rights || {};
        const currentPerms = currentUser.permissions || [];
        // Strictly follow mod_12 even for admins
        const hasRight = currentRights['mod_12'] || currentPerms.includes('mod_12');

        if (!hasRight) {
            alert('Access Denied: You do not have Employee Advance Modification rights.');
            return;
        }

        // Close Modal
        const modalEl = document.getElementById('authModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        // Proceed with pending action
        if (pendingAction === 'edit') {
            await executeEdit(pendingId);
        } else if (pendingAction === 'delete') {
            if (confirm('Are you sure you want to delete this advance?')) {
                await executeDelete(pendingId);
            }
        }

    } catch (e) {
        console.error('Modification verification error:', e);
        alert('Error verifying permissions');
    }
}
// clearForm and loadBranches are already defined above


function openInstallmentModal() {
    const empInputVal = document.getElementById('employeeInput').value;

    if (!empInputVal) {
        alert('Please select an employee first');
        return;
    }

    // Set Header Info - Parse Name from "Code - Name"
    const namePart = empInputVal.split(' - ')[1] || empInputVal;

    document.getElementById('modalEmpName').textContent = namePart;
    document.getElementById('modalEmpCode').value = document.getElementById('code').value;

    // Load Data into Modal Inputs
    // Pre Month - 100% independent sync
    const preBal1 = parseFloat(document.getElementById('preMonthBal').value) || 0;
    document.getElementById('modalPreBal1').value = preBal1;

    // Default to the saved installment if available, otherwise suggest full balance
    const inst1 = (currentInstallmentData.isFromHistory)
        ? currentInstallmentData.preMonthInstallment.installment
        : preBal1;
    document.getElementById('modalInstallment1').value = inst1;

    // Current Month - 100% independent sync
    const currMonthBal = parseFloat(document.getElementById('currentMonthBal').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    const type = document.getElementById('transactionType').value;

    // Calculated live balance for THIS month specifically
    const preBal2 = currMonthBal + (type === 'Pay' ? paid : -paid);

    // Default to 'preBal2' if no history, otherwise use saved. 
    let inst2 = preBal2;
    if (currentInstallmentData.isFromHistory) {
        inst2 = currentInstallmentData.currentMonthInstallment.installment;
    }

    document.getElementById('modalPreBal2').value = preBal2;
    document.getElementById('modalInstallment2').value = inst2;

    calculateModalTotals();

    // Add Live Calculation Listeners
    document.getElementById('modalInstallment1').oninput = calculateModalTotals;
    document.getElementById('modalInstallment2').oninput = calculateModalTotals;

    const myModal = new bootstrap.Modal(document.getElementById('installmentModal'));
    myModal.show();

    // Track modal state for keyboard shortcut
    document.getElementById('installmentModal').dataset.isOpen = 'true';
    document.getElementById('installmentModal').addEventListener('hidden.bs.modal', function () {
        this.dataset.isOpen = 'false';
    });
}

function calculateModalTotals() {
    // Pre Month
    const preBal1 = parseFloat(document.getElementById('modalPreBal1').value) || 0;
    const installment1 = parseFloat(document.getElementById('modalInstallment1').value) || 0;
    const balance1 = preBal1 - installment1;
    document.getElementById('modalBalance1').value = balance1;

    // Current Month
    const preBal2 = parseFloat(document.getElementById('modalPreBal2').value) || 0;
    const installment2 = parseFloat(document.getElementById('modalInstallment2').value) || 0;
    const balance2 = preBal2 - installment2;
    document.getElementById('modalBalance2').value = balance2;
}

function saveInstallment() {
    const inst1 = parseFloat(document.getElementById('modalInstallment1').value) || 0;
    const inst2 = parseFloat(document.getElementById('modalInstallment2').value) || 0;
    const bal1 = parseFloat(document.getElementById('modalBalance1').value) || 0;
    const bal2 = parseFloat(document.getElementById('modalBalance2').value) || 0;

    if (bal1 < 0 || bal2 < 0) {
        alert('Negative Balance is not allowed. Please check Installment Amount.');
        return;
    }

    // Update internal tracker - ONLY metadata for Payroll
    currentInstallmentData.preMonthInstallment = {
        preBal: parseFloat(document.getElementById('modalPreBal1').value) || 0,
        installment: inst1,
        balance: bal1
    };

    currentInstallmentData.currentMonthInstallment = {
        preBal: parseFloat(document.getElementById('modalPreBal2').value) || 0,
        installment: inst2,
        balance: bal2
    };

    // Close Modal
    const modalEl = document.getElementById('installmentModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Persist as metadata (does NOT change Form's Paid/Type per user request)
    saveAdvance('Installment Plan Saved Successfully');
}
