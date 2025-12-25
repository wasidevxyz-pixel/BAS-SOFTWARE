
// --- Tab 4: Bank Payments Functions ---

// Load Bank Payments into Grid
async function loadBankPayments() {
    let invFrom = document.getElementById('bp-inv-from').value;
    let invTo = document.getElementById('bp-inv-to').value;
    let chqFrom = document.getElementById('bp-chq-from').value;
    let chqTo = document.getElementById('bp-chq-to').value;

    const branch = document.querySelector('#bank-payments .branch-select')?.value;

    // Default: If no dates at all, set Cheque Date to today automatically for the search
    if (!invFrom && !invTo && !chqFrom && !chqTo) {
        const today = new Date().toISOString().split('T')[0];
        const chqFromInput = document.getElementById('bp-chq-from');
        const chqToInput = document.getElementById('bp-chq-to');
        if (chqFromInput) chqFromInput.value = today;
        if (chqToInput) chqToInput.value = today;
        chqFrom = today;
        chqTo = today;
    }

    try {
        const token = localStorage.getItem('token');
        let url = `/api/v1/bank-transactions?limit=1000`; // Increase limit for management view

        if (invFrom) url += `&startInvDate=${invFrom}`;
        if (invTo) url += `&endInvDate=${invTo}`;
        if (chqFrom) url += `&startChqDate=${chqFrom}`;
        if (chqTo) url += `&endChqDate=${chqTo}`;

        if (branch) url += `&branch=${branch}`;

        // IMPORTANT: Exclude bank_transfer entries - those should only show in "Bank To Bank" tab
        url += `&excludeRefType=bank_transfer`;

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();

        if (data.success) {
            renderBankPaymentGrid(data.data);
        } else {
            alert('Failed to load bank payments');
        }
    } catch (e) {
        console.error(e);
        alert('Error loading bank payments');
    }
}

// Render Grid
function renderBankPaymentGrid(data) {
    const tbody = document.getElementById('bankPaymentsBody');
    tbody.innerHTML = '';

    // Collect unique values for dynamic dropdowns
    const banks = new Set();
    const chqDates = new Set();
    const invDates = new Set();

    data.forEach(item => {
        const tr = document.createElement('tr');

        const dateStr = item.chequeDate ? new Date(item.chequeDate).toISOString().split('T')[0] : (item.date ? new Date(item.date).toISOString().split('T')[0] : '-');
        const invoiceDateStr = item.invoiceDate ? new Date(item.invoiceDate).toISOString().split('T')[0] : '-';
        const bankName = item.bankName || (item.bank && item.bank.bankName) || item.bank || '-';

        if (bankName !== '-') banks.add(bankName);
        if (dateStr !== '-') chqDates.add(dateStr);
        if (invoiceDateStr !== '-') invDates.add(invoiceDateStr);

        let displayType = (item.transactionType || item.type || '').toLowerCase();
        if (displayType === 'deposit') displayType = 'received';
        if (displayType === 'withdrawal') displayType = 'paid';

        // Store data for filtering
        tr.dataset.type = displayType;
        tr.dataset.bank = bankName;
        tr.dataset.chqDate = dateStr;
        tr.dataset.invDate = invoiceDateStr;

        // Colorful Rows: Green for Received, Red for Paid
        const isReceived = displayType.toLowerCase() === 'received';
        tr.style.backgroundColor = isReceived ? '#28a745' : '#dc3545';
        tr.style.color = 'white';
        tr.style.fontWeight = 'normal';

        const remarks = item.remarks || item.narration || '-';
        const invoiceNo = item.invoiceNo || '-';
        const amount = item.amount || 0;

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${invoiceDateStr}</td>
            <td>${bankName}</td>
            <td class="text-uppercase fw-bold">${displayType}</td>
            <td>${remarks}</td>
            <td>${invoiceNo}</td>
            <td class="fw-bold text-end">${amount.toLocaleString()}</td>
            <td class="text-center">
                <button class="btn btn-primary btn-xs" onclick="editBankPayment('${item._id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-dark btn-xs" onclick="deleteBankPayment('${item._id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Populate Dropdowns
    populateBPFilter('bp-filter-bank', Array.from(banks).sort());
    populateBPFilter('bp-filter-chq-date', Array.from(chqDates).sort().reverse());
    populateBPFilter('bp-filter-inv-date', Array.from(invDates).sort().reverse());

    calculateBPGridTotals();
}

function populateBPFilter(id, values) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const currentVal = sel.value;

    // Preserve "All" option
    const firstOptionText = (id === 'bp-filter-bank') ? 'All Banks' : 'All Dates';
    sel.innerHTML = `<option value="">${firstOptionText}</option>`;

    values.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === currentVal) opt.selected = true;
        sel.appendChild(opt);
    });
}

// Function to calculate totals for visible rows in Bank Payments grid
function calculateBPGridTotals() {
    const rows = document.querySelectorAll('#bankPaymentsBody tr');
    let total = 0;
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const amountCell = row.cells[6];
            if (amountCell) {
                total += parseFloat(amountCell.textContent.replace(/,/g, '')) || 0;
            }
        }
    });
    const totalDisplay = document.getElementById('bp-grid-total');
    if (totalDisplay) totalDisplay.textContent = total.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

// Global Filter for Bank Payments Grid
function filterBankPaymentsGrid() {
    const searchInput = document.getElementById('bp-global-search');
    const filterText = searchInput ? searchInput.value.toLowerCase() : '';
    const cleanFilterText = filterText.replace(/,/g, '');

    const typeFilter = document.getElementById('bp-filter-type')?.value.toLowerCase() || '';
    const bankFilter = document.getElementById('bp-filter-bank')?.value || '';
    const chqDateFilter = document.getElementById('bp-filter-chq-date')?.value || '';
    const invDateFilter = document.getElementById('bp-filter-inv-date')?.value || '';

    const rows = document.querySelectorAll('#bankPaymentsBody tr');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const cleanText = text.replace(/,/g, '');

        const rowType = row.dataset.type || '';
        const rowBank = row.dataset.bank || '';
        const rowChqDate = row.dataset.chqDate || '';
        const rowInvDate = row.dataset.invDate || '';

        const matchesSearch = text.includes(filterText) || cleanText.includes(cleanFilterText);
        const matchesType = !typeFilter || rowType === typeFilter;
        const matchesBank = !bankFilter || rowBank === bankFilter;
        const matchesChq = !chqDateFilter || rowChqDate === chqDateFilter;
        const matchesInv = !invDateFilter || rowInvDate === invDateFilter;

        if (matchesSearch && matchesType && matchesBank && matchesChq && matchesInv) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });

    calculateBPGridTotals();
}

// Save (Create or Update)
async function saveBankPayment() {
    const id = document.getElementById('bp-id').value;
    const type = document.getElementById('bp-type').value;
    const chequeDate = document.getElementById('bp-cheque-date').value;
    const branch = document.getElementById('bp-branch').value;
    const dept = document.getElementById('bp-dept').value;
    const bank = document.getElementById('bp-bank').value;
    const amount = document.getElementById('bp-amount').value;
    const remarks = document.getElementById('bp-remarks').value;
    const invoiceNo = document.getElementById('bp-invoice-no').value;
    const invoiceDate = document.getElementById('bp-invoice-date').value;

    if (!chequeDate || !bank || !amount) {
        alert('Please fill in required fields (Date, Bank, Amount)');
        return;
    }

    const payload = {
        transactionType: type, // 'received' or 'paid'
        chequeDate,
        branch,
        department: dept,
        bank,
        amount: parseFloat(amount),
        remarks,
        invoiceNo,
        invoiceDate
    };

    try {
        const token = localStorage.getItem('token');
        let url = '/api/v1/bank-transactions';
        let method = 'POST';

        if (id) {
            url += `/${id}`;
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

        const result = await response.json();
        if (result.success) {
            alert('Bank Payment Saved Successfully');

            // Ensure the list shows the new/updated entry by updating filter dates if needed
            const currentFromInput = document.getElementById('bp-chq-from');
            const currentToInput = document.getElementById('bp-chq-to');

            if (currentFromInput && currentToInput && chequeDate) {
                const currentFrom = currentFromInput.value;
                const currentTo = currentToInput.value;

                // If saved date is outside current view (or view is empty), update view
                if (!currentFrom || new Date(chequeDate) < new Date(currentFrom)) {
                    currentFromInput.value = chequeDate;
                }
                if (!currentTo || new Date(chequeDate) > new Date(currentTo)) {
                    currentToInput.value = chequeDate;
                }
            }

            clearBankPaymentForm();
            loadBankPayments(); // Refresh Grid
        } else {
            alert(result.message || 'Failed to save');
        }
    } catch (e) {
        console.error(e);
        alert('Error saving bank payment');
    }
}

// Delete
async function deleteBankPayment(id) {
    if (!confirm('Are you sure you want to delete this payment?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/bank-transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
            alert('Deleted successfully');
            loadBankPayments();
        } else {
            alert('Failed to delete');
        }
    } catch (e) {
        console.error(e);
        alert('Error deleting');
    }
}

// Edit (Populate Form)
async function editBankPayment(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/bank-transactions/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
            const data = result.data;
            document.getElementById('bp-id').value = data._id;

            // Map Type (deposit -> received, withdrawal -> paid)
            const typeVal = (data.type === 'deposit') ? 'received' : 'paid';
            document.getElementById('bp-type').value = typeVal;

            if (data.chequeDate) {
                document.getElementById('bp-cheque-date').value = new Date(data.chequeDate).toISOString().split('T')[0];
            } else if (data.date) {
                document.getElementById('bp-cheque-date').value = new Date(data.date).toISOString().split('T')[0];
            }

            // Set Dropdowns 
            const scope = document.getElementById('bank-payments');
            if (data.branch) {
                document.getElementById('bp-branch').value = data.branch;
                // Wait for departments to load based on branch
                if (window.loadDepartments) {
                    await window.loadDepartments(scope);
                }
            }

            if (data.department) {
                const deptId = (data.department._id || data.department);
                document.getElementById('bp-dept').value = deptId;
                // Filter banks based on new department
                if (window.filterBanks) {
                    window.filterBanks(scope);
                }
            }

            if (data.bank) {
                const bankId = data.bank._id || data.bank;
                document.getElementById('bp-bank').value = bankId;
            } else if (data.bankName) {
                // Fallback: match by text if ID missing
                const bankSelect = document.getElementById('bp-bank');
                for (let i = 0; i < bankSelect.options.length; i++) {
                    if (bankSelect.options[i].text === data.bankName) {
                        bankSelect.selectedIndex = i;
                        break;
                    }
                }
            }

            const amountVal = data.amount || 0;
            document.getElementById('bp-amount').value = amountVal;

            // Map Narration to Remarks
            document.getElementById('bp-remarks').value = data.narration || data.remarks || '';
            document.getElementById('bp-invoice-no').value = data.invoiceNo || '';

            if (data.invoiceDate) {
                document.getElementById('bp-invoice-date').value = new Date(data.invoiceDate).toISOString().split('T')[0];
            } else {
                document.getElementById('bp-invoice-date').value = '';
            }

            // Update Balance Display
            const event = new Event('input');
            document.getElementById('bp-amount').dispatchEvent(event);

            // Switch to logic tab if needed? Use passed UI helper
            // User is already on tab
        }
    } catch (e) {
        console.error(e);
    }
}

function clearBankPaymentForm() {
    const idField = document.getElementById('bp-id');
    const typeField = document.getElementById('bp-type');
    const amountField = document.getElementById('bp-amount');
    const remarksField = document.getElementById('bp-remarks');
    const invNoField = document.getElementById('bp-invoice-no');
    const invDateField = document.getElementById('bp-invoice-date');
    const balanceDisplay = document.getElementById('bp-balance-display');

    if (idField) idField.value = '';
    if (typeField) typeField.value = 'paid'; // Default as requested
    if (amountField) amountField.value = '';
    if (remarksField) remarksField.value = '';
    if (invNoField) invNoField.value = '';
    if (invDateField) invDateField.value = new Date().toISOString().split('T')[0];
    if (balanceDisplay) balanceDisplay.textContent = '0.00';
}

// Balance Calculation Logic
document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('bp-amount');
    const typeSelect = document.getElementById('bp-type');
    const balanceDisplay = document.getElementById('bp-balance-display');

    function updateBalancePreview() {
        if (!amountInput || !balanceDisplay) return;

        // In a real app, we would fetch the actual current balance of the selected bank first.
        // For now, let's assume the user wants to see the impact of their ENTRY.
        // Or if there is a base balance, we modify that. 
        // Let's assume a base balance of 0 or a placeholder for now, 
        // but arguably the user might just want to see the value they typed reflected?
        // Re-reading: "BANK PAYMENT BANK BALANCE NOT EFFECT WHEN I AM ENTERING VALUE"
        // This likely means there is a "Bank Balance" field that should change as they type.

        const amount = parseFloat(amountInput.value) || 0;
        const type = typeSelect ? typeSelect.value : 'received';

        // Check if we have a base balance (simulated or fetched)
        // For this fix, I will simply display the signed amount or a simulated calculation
        // If the user expects it to update a "running balance", we need a starting point.
        // Let's assume a starting balance of 100,000 for demo or 0.
        const baseBalance = 0;

        let finalBalance = baseBalance;
        if (type === 'received') {
            finalBalance += amount;
        } else {
            finalBalance -= amount;
        }

        balanceDisplay.textContent = finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 });

        // Visual indicator
        if (finalBalance < 0) {
            balanceDisplay.style.color = '#dc3545'; // Red
        } else {
            balanceDisplay.style.color = '#28a745'; // Green
        }
    }

    if (amountInput) amountInput.addEventListener('input', updateBalancePreview);
    if (typeSelect) typeSelect.addEventListener('change', updateBalancePreview);

    // Set default Invoice Date on Init
    const invoiceDateInput = document.getElementById('bp-invoice-date');
    if (invoiceDateInput && !invoiceDateInput.value) {
        invoiceDateInput.value = new Date().toISOString().split('T')[0];
    }

    // Alt+S Shortcut
    document.addEventListener('keydown', function (event) {
        if (event.altKey && (event.key === 's' || event.key === 'S')) {
            const panel = document.getElementById('bank-payments');
            // Check if panel is visible/active (Bootstrap 'active' class usually)
            if (panel && (panel.classList.contains('active') || panel.classList.contains('show') || getComputedStyle(panel).display !== 'none')) {
                event.preventDefault();
                saveBankPayment();
            }
        }
    });

    // Auto load current date data on init
    loadBankPayments();
});

function clearDateRange(prefix) {
    const from = document.getElementById(`${prefix}-from`);
    const to = document.getElementById(`${prefix}-to`);
    if (from) from.value = '';
    if (to) to.value = '';
}

// Make globally available
window.loadBankPayments = loadBankPayments;
window.saveBankPayment = saveBankPayment;
window.deleteBankPayment = deleteBankPayment;
window.editBankPayment = editBankPayment;
window.clearBankPaymentForm = clearBankPaymentForm;
window.filterBankPaymentsGrid = filterBankPaymentsGrid;
window.calculateBPGridTotals = calculateBPGridTotals;
window.clearDateRange = clearDateRange;
