document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Fields - Default Cheque Dates to today, others empty for "yyyy-mm-dd"
    const today = new Date().toISOString().split('T')[0];
    const dateFields = document.querySelectorAll('input[type="date"]');
    dateFields.forEach(field => {
        const id = field.id;
        if (id === 'bp-chq-from' || id === 'bp-chq-to' || id === 'bd-from-date' || id === 'bd-to-date' || id === 'bs-from-date' || id === 'bs-to-date' || id === 'btb-date' || id === 'btb-filter-from' || id === 'btb-filter-to') {
            field.value = today;
        } else if (id.includes('from') || id.includes('to') || id.includes('search')) {
            field.value = '';
        } else {
            field.value = today;
        }
    });

    // Initial Load - Load Banks FIRST so we can filter departments by them
    await loadAllBanks();
    await loadBranches();
    // Set default tab based on URL hash or first tab
    const hash = window.location.hash || '#bank-detail';
    const tabTrigger = document.querySelector(`button[data-bs-target="${hash}"]`);
    if (tabTrigger) tabTrigger.click();

    // Event Listeners for Filters
    document.querySelectorAll('.branch-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const scope = e.target.closest('.tab-pane');
            if (scope) {
                console.log(`Branch changed in ${scope.id}, reloading departments/banks`);
                loadDepartments(scope);

                // Special handling for Bank Payments tab
                if (scope.id === 'bank-payments') {
                    if (window.populateBPFilterFromReference) window.populateBPFilterFromReference();
                    if (window.loadBankPayments) window.loadBankPayments();
                }
            }
        });
    });

    // Specific listener for Pending Chq filters to reload grid data
    const pcBranch = document.getElementById('pc-branch');
    const pcBank = document.getElementById('pc-bank');
    if (pcBranch) pcBranch.addEventListener('change', () => loadPendingChqData());
    if (pcBank) pcBank.addEventListener('change', () => loadPendingChqData());

    const pcDate = document.getElementById('pc-bank-date');
    if (pcDate) pcDate.addEventListener('change', () => loadPendingChqData());

    const pcSaveBtn = document.getElementById('pc-save-btn');
    if (pcSaveBtn) {
        pcSaveBtn.addEventListener('click', () => {
            const branch = document.getElementById('pc-branch').value;
            const bankSelect = document.getElementById('pc-bank');
            const bank = bankSelect.value;
            const bankName = bankSelect.options[bankSelect.selectedIndex]?.text || bank;
            const date = document.getElementById('pc-bank-date').value;
            const stmtDate = document.getElementById('pc-stmt-date').value;
            const ledger = document.getElementById('pc-bank-amount').value;
            const pending = document.getElementById('pc-pending-chq').value;
            const statement = document.getElementById('pc-statement').value;
            const diff = document.getElementById('pc-diff').value;

            if (!branch || !bank || !date) {
                alert('Please select Branch, Bank and Date');
                return;
            }

            const record = {
                id: Date.now().toString(),
                dated: new Date().toISOString().split('T')[0],
                sysDate: new Date().toLocaleTimeString(),
                branch,
                bank: bankName, // Save Name instead of ID
                bankId: bank,   // Save ID separately if needed
                bankDate: date,
                stmtDate: stmtDate,
                ledger: parseFloat(ledger),
                pending: parseFloat(pending),
                statement: parseFloat(statement),
                diff: parseFloat(diff)
            };

            const history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');
            history.unshift(record);
            localStorage.setItem('pending_chq_history', JSON.stringify(history));

            alert('Data saved successfully.');
            loadPendingChqData();

            // Clear Statement field for next entry
            document.getElementById('pc-statement').value = '';
            // Recalculate diff (will likely go back to Bank + Pending)
            calculateDiff();
        });
    }

    document.querySelectorAll('.dept-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const scope = e.target.closest('.tab-pane');
            filterBanks(scope);
        });
    });

    // Tab Activation Listeners
    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            const target = e.target.getAttribute('data-bs-target');
            if (target === '#bank-to-bank') {
                loadBTBTransfers();
            }
        });
    });

    // Select All functionality for Bank Detail tab
    const selectAllDetails = document.getElementById('selectAllBatches');
    if (selectAllDetails) {
        selectAllDetails.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const rows = document.querySelectorAll('#bankDetailsBody tr');

            rows.forEach(row => {
                // Only toggle visible rows
                if (row.style.display !== 'none') {
                    const checkbox = row.querySelector('.batch-checkbox');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        // REMOVED: applyRowColor(row, isChecked); 
                        // Color change will happen only on Update button click
                    }
                }
            });
            // REMOVED: calculateGridTotals(); 
            // Totals should only update AFTER "Update" is clicked and saved.
        });
    }

    // Auto-search on Bank Mode Switch
    const modeRadios = document.getElementsByName('bankActionType');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            searchBankDetails();
        });
    });
    // Prevent Dropdown from closing when clicking inside (for Multi-Select)
    document.querySelectorAll('.dropdown-menu.stop-propagation').forEach(menu => {
        menu.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    });
});

let allBranches = [];
let allDepartments = [];
let allBanksReference = []; // To store all banks and filter locally

// Shared Data Loaders
async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success) {
            allBranches = data.data;
            const selects = document.querySelectorAll('.branch-select');
            selects.forEach(sel => {
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">Select Branch</option>'; // Or PWD-1 as default if needed
                allBranches.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.name;
                    opt.textContent = b.name;
                    sel.appendChild(opt);
                });
                // Default to first if only one available
                if (allBranches.length === 1) sel.value = allBranches[0].name;
            });
            // Trigger department load for all scopes
            document.querySelectorAll('.tab-pane').forEach(scope => loadDepartments(scope));
        }
    } catch (e) { console.error(e); }
}

async function loadDepartments(scopeElement) {
    if (!scopeElement) return;
    const branchSel = scopeElement.querySelector('.branch-select');
    const deptSel = scopeElement.querySelector('.dept-select');

    // BTB and Pending Chq screens don't have dept select, they filter banks by branch directly
    if (!branchSel) return;
    if (scopeElement.id === 'bank-to-bank' || scopeElement.id === 'pending-chq') {
        filterBanks(scopeElement);
        return;
    }
    if (!deptSel) return;

    const branch = branchSel.value;
    deptSel.innerHTML = '<option value="">Select Department</option>';

    if (!branch) return;

    try {
        const token = localStorage.getItem('token');
        // We could cache this but fetching for freshness is safer for now
        const response = await fetch('/api/v1/departments', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success) {
            // Filter departments: Must be active, match branch, AND have at least one bank
            // Sort departments first
            const sorted = data.data.sort((a, b) => {
                const codeA = parseInt(a.code) || 999999;
                const codeB = parseInt(b.code) || 999999;
                return codeA - codeB || a.name.localeCompare(b.name);
            });

            // Filter departments: Must be active, match branch, AND have at least one bank
            const filtered = sorted.filter(d => {
                const isActiveAndBranch = d.branch === branch && d.isActive;
                if (!isActiveAndBranch) return false;

                // Filter: Hide specialized internal departments
                if (d.name === 'PERCENTAGE CASH' || d.name === 'CASH REC FROM COUNTER') return false;

                // Filter: Hide if only 'Closing_2_Comp_Sale' is set
                if (d.closing2CompSale && !d.closing2DeptDropDown) return false;

                // Check if any bank belongs to this department
                // Bank department field can be ID string or object
                const hasBank = allBanksReference.some(b => {
                    const bankDeptId = (b.department && b.department._id) ? b.department._id : b.department;
                    return bankDeptId === d._id;
                });
                return hasBank;
            });

            if (filtered.length === 0) {
                const opt = document.createElement('option');
                opt.textContent = "No Departments with Banks";
                opt.disabled = true;
                opt.selected = true;
                deptSel.appendChild(opt);
            } else {
                filtered.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d._id;
                    opt.textContent = d.name;
                    deptSel.appendChild(opt);
                });
            }
            // Trigger bank filter
            filterBanks(scopeElement);
        }
    } catch (e) { console.error(e); }
}

async function loadAllBanks() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/banks', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success) {
            allBanksReference = data.data;
            // Initial filter for active tabs
            document.querySelectorAll('.tab-pane').forEach(scope => filterBanks(scope));
        }
    } catch (e) { console.error(e); }
}

function filterBanks(scopeElement) {
    if (!scopeElement) return;
    // Custom Multi-Select Logic for Bank Detail and Bank Summary Tabs
    if (scopeElement.id === 'bank-detail' || scopeElement.id === 'bank-summary') {
        populateBankMultiSelect(scopeElement);
    }

    // Standard Select Logic for other tabs
    const bankSelects = scopeElement.querySelectorAll('.bank-select');
    if (bankSelects.length === 0) return;

    const branchSel = scopeElement.querySelector('.branch-select');
    const branchVal = branchSel ? branchSel.value : null;
    const deptVal = scopeElement.querySelector('.dept-select')?.value;

    console.log(`Filtering banks for ${scopeElement.id}. Branch: ${branchVal}, Dept: ${deptVal}`);

    bankSelects.forEach(bankSel => {
        const currentVal = bankSel.value;
        bankSel.innerHTML = '<option value="">Select Bank</option>';

        const filtered = allBanksReference.filter(b => {
            // Match Branch: handle object (name/id) or direct string
            if (branchVal) {
                const bBranchName = (b.branch && typeof b.branch === 'object') ? b.branch.name : b.branch;
                const bBranchId = (b.branch && typeof b.branch === 'object') ? b.branch._id : b.branch;

                // Try matching by name or ID
                if (bBranchName !== branchVal && bBranchId !== branchVal) return false;
            }

            // Match Department
            if (deptVal) {
                const bDeptId = (b.department && typeof b.department === 'object') ? b.department._id : b.department;
                if (bDeptId && bDeptId !== deptVal) return false;
            }

            // Rule: 'Branch Bank' type is specific to Pending Chq tab
            if (scopeElement.id === 'pending-chq') {
                // Pending Chq: Show ONLY Branch Banks
                if (b.bankType !== 'Branch Bank') return false;
            } else {
                // Other Tabs: Hide Branch Banks
                if (b.bankType === 'Branch Bank') return false;
            }

            return true;
        });

        filtered.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b._id;
            opt.textContent = b.bankName;
            bankSel.appendChild(opt);
        });

        // If the previous selection is still valid in the new list, keep it
        if (currentVal && filtered.some(b => b._id === currentVal)) {
            bankSel.value = currentVal;
        } else if (filtered.length > 0 && scopeElement.id === 'pending-chq') {
            // Auto-select first bank for Pending Chq screen if nothing selected
            // bankSel.selectedIndex = 1; 
        }
    });
}

// Expose functions for other logic files
window.loadDepartments = loadDepartments;
window.filterBanks = filterBanks;
window.loadBranches = loadBranches;
window.loadAllBanks = loadAllBanks;
window.updateBankRowsStatus = updateBankRowsStatus;
window.allBanksReference = allBanksReference;
window.populateBankMultiSelect = populateBankMultiSelect;
window.toggleAllBanks = toggleAllBanks;
window.filterBankDropdownItems = filterBankDropdownItems;
window.updateBankButtonText = updateBankButtonText;

// --- Multi-Select Helpers ---
function populateBankMultiSelect(scopeElement) {
    if (!scopeElement) return;
    const isSummary = scopeElement.id === 'bank-summary';
    const prefix = isSummary ? 'bs' : 'bd';

    const listContainer = document.getElementById(`${prefix}BankList`);
    const branchSel = scopeElement.querySelector('.branch-select');
    const deptSel = scopeElement.querySelector('.dept-select');

    const branch = branchSel ? branchSel.value : '';
    const dept = deptSel ? deptSel.value : '';

    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Reset Select All
    const checkAll = document.getElementById(isSummary ? 'checkAllBanksSummary' : 'checkAllBanks');
    if (checkAll) checkAll.checked = false;

    // Filter banks based on Branch and Dept
    const filtered = allBanksReference.filter(b => {
        if (branch) {
            const bBranchName = (b.branch && typeof b.branch === 'object') ? b.branch.name : b.branch;
            const bBranchId = (b.branch && typeof b.branch === 'object') ? b.branch._id : b.branch;
            // Name or ID match
            if (bBranchName !== branch && bBranchId !== branch) return false;
        }
        if (dept) {
            const bDeptId = (b.department && typeof b.department === 'object') ? b.department._id : b.department;
            if (bDeptId && bDeptId !== dept) return false;
        }
        // Multi-select tabs usually hide Branch Banks (keep consistent with previous logic)
        if (b.bankType === 'Branch Bank') return false;

        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="text-muted p-2 small">No banks found</div>';
    } else {
        filtered.forEach(b => {
            const div = document.createElement('div');
            div.className = 'form-check mb-1 dropdown-item-text';
            div.innerHTML = `
                <input class="form-check-input bank-checkbox" type="checkbox" value="${b._id}" id="chk_${prefix}_${b._id}" onchange="updateBankButtonText('${scopeElement.id}')">
                <label class="form-check-label small" for="chk_${prefix}_${b._id}" style="cursor:pointer; width: 100%;">${b.bankName}</label>
             `;
            listContainer.appendChild(div);
        });
    }
    updateBankButtonText(scopeElement.id);
}

function toggleAllBanks(source, scopeId) {
    const prefix = scopeId === 'bank-summary' ? 'bs' : 'bd';
    const checkboxes = document.querySelectorAll(`#${prefix}BankList .bank-checkbox`);
    checkboxes.forEach(cb => {
        // Only toggle visible ones (if filtered)
        if (cb.closest('div').style.display !== 'none') {
            cb.checked = source.checked;
        }
    });
    updateBankButtonText(scopeId);
}

function filterBankDropdownItems(input, scopeId) {
    const prefix = scopeId === 'bank-summary' ? 'bs' : 'bd';
    const filter = input.value.toLowerCase();
    const items = document.querySelectorAll(`#${prefix}BankList .form-check`);
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(filter) ? '' : 'none';
    });
}

function updateBankButtonText(scopeId = 'bank-detail') {
    const isSummary = scopeId === 'bank-summary';
    const prefix = isSummary ? 'bs' : 'bd';
    const checked = document.querySelectorAll(`#${prefix}BankList .bank-checkbox:checked`);
    const btnId = isSummary ? 'bsBankDropdownBtn' : 'bdBankDropdownBtn';
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const span = btn.querySelector('span');

    if (checked.length === 0) {
        span.textContent = 'Select Banks';
    } else if (checked.length === 1) {
        // Find label
        const id = checked[0].id;
        const label = document.querySelector(`label[for="${id}"]`).textContent;
        span.textContent = label;
    } else {
        span.textContent = `${checked.length} Banks Selected`;
    }
}

// --- Tab 1: Bank Detail Functions ---
async function searchBankDetails() {
    const fromDate = document.getElementById('bd-from-date').value;
    const toDate = document.getElementById('bd-to-date').value;
    const branch = document.getElementById('bd-branch').value;
    const dept = document.getElementById('bd-dept').value;
    // Multi-Select: Get all checked values
    const selectedBanks = Array.from(document.querySelectorAll('#bdBankList .bank-checkbox:checked')).map(cb => cb.value);

    // const bank = document.getElementById('bd-bank').value; // OLD SINGLE SELECT

    const isDeduction = document.getElementById('deductionOption').checked; // If true, filter for batches/deductions

    if (!fromDate || !toDate) {
        alert('Please select a date range');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        let url;

        if (isDeduction) {
            // Bank Deduction (Daily Cash)
            // User requested "all bank entries" from daily cash
            url = `/api/v1/daily-cash?startDate=${fromDate}&endDate=${toDate}&mode=Bank&hasBank=true`;
            if (branch) url += `&branch=${branch}`;
        } else {
            // Bank Payment (Bank Transactions) - Exclude bank_transfer entries (those show in Bank To Bank tab)
            url = `/api/v1/bank-transactions?startDate=${fromDate}&endDate=${toDate}&excludeRefType=bank_transfer`;
            if (branch) url += `&branch=${branch}`;
        }

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();

        if (data.success) {
            let filtered = data.data;

            // Client-side Refined Filtering
            if (isDeduction) {
                // EXTREMELY STRICT: If there is no bank object, it is "Cash data" and must NOT show here.
                filtered = filtered.filter(item => item.bank && (item.bank.bankName || typeof item.bank === 'string'));
            }

            if (dept) filtered = filtered.filter(item => item.department && (item.department._id === dept || item.department === dept));

            if (selectedBanks.length > 0) {
                filtered = filtered.filter(item => {
                    if (isDeduction) {
                        // For Bank Deduction (Daily Cash), check bank object or ID
                        const itemBankId = (item.bank && item.bank._id) ? item.bank._id : item.bank;
                        // Check if itemBankId matches ANY of the selected banks
                        return selectedBanks.includes(itemBankId);
                    } else {
                        // For Bank Payment (Bank Transactions), check bankName
                        // We must match the item's bank name to one of the SELECTED banks' names
                        // 1. Get names of selected banks
                        const selectedBankNames = allBanksReference
                            .filter(b => selectedBanks.includes(b._id))
                            .map(b => b.bankName);

                        const itemBankName = item.bankName || (item.bank && item.bank.bankName) || item.bank;
                        return selectedBankNames.includes(itemBankName);
                    }
                });
            }

            // CRITICAL: Additional client-side filter for Bank Payment mode
            // Exclude Bank Transfer entries (in case refType field is missing in old records)
            if (!isDeduction) {
                filtered = filtered.filter(item => {
                    const narration = (item.narration || item.remarks || '').toLowerCase();
                    // Exclude if narration contains "bank transfer"
                    if (narration.includes('bank transfer')) return false;

                    // Exclude "Received" type entries (deposits) - only show "Paid" (withdrawals)
                    const transType = (item.transactionType || item.type || '').toLowerCase();
                    if (transType === 'deposit' || transType === 'received') return false;

                    return true;
                });
            }

            // Map Data to Common Format
            const mappedData = filtered.map(item => {
                let mapped = {
                    date: item.date,
                    bank: item.bank,
                    remarks: item.remarks || item.details || item.description || '',
                    batchNo: item.batchNo || '-',
                    _id: item._id,
                    isVerified: item.isVerified || false,
                    department: item.department ? (item.department.name || item.department) : '-'
                };

                if (isDeduction) {
                    const ratePerc = item.deductedAmount || 0;
                    // Fix: totalAmount acts as the Gross Amount. Do not add ratePerc.
                    const grossBase = parseFloat(item.totalAmount) || 0;

                    mapped.ratePercent = ratePerc;
                    mapped.amount = grossBase;
                    mapped.deduction = (grossBase * ratePerc) / 100;
                    mapped.total = Math.round(grossBase - mapped.deduction);

                    mapped.department = item.department ? (item.department.name || item.department) : '-';
                    mapped.bank = item.bank && item.bank.bankName ? item.bank.bankName : (item.bankName || item.bank || '-');
                    mapped.remarks = item.remarks || item.description || '';
                    mapped.batchNo = item.batchID || item.batchNo || '-';
                } else {
                    // Bank Payment Logic (BankTransaction model)
                    mapped.amount = item.amount || 0;
                    mapped.deduction = 0;
                    mapped.total = item.amount || 0;

                    // Map correct fields from BankTransaction
                    mapped.bank = item.bankName || (item.bank && item.bank.bankName) || item.bank || '-';
                    mapped.remarks = item.narration || item.remarks || '-';
                    mapped.batchNo = item.invoiceNo || '-';
                    mapped.department = item.department ? (item.department.name || item.department) : '-';
                }
                return mapped;
            });

            // Sort by Date Ascending (Oldest first at top, Newest at bottom)
            mappedData.sort((a, b) => new Date(a.date) - new Date(b.date));

            renderBankDetailGrid(mappedData, isDeduction);
        } else {
            console.error(data.message);
            alert('Failed to fetch data');
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching data');
    }
}

function renderBankDetailGrid(data, isDeduction) {
    const tbody = document.getElementById('bankDetailsBody');
    tbody.innerHTML = '';

    // Toggle Headers Visibility
    const headers = document.querySelectorAll('#bankDetailsTable thead th');
    if (headers.length > 0) {
        // Indices: 2 (Batch Transfer Date), 6 (Rate), 7 (Deduction), 8 (Total)
        const displayStyle = isDeduction ? '' : 'none';
        if (headers[2]) headers[2].style.display = displayStyle;
        if (headers[6]) headers[6].style.display = displayStyle;
        if (headers[7]) headers[7].style.display = displayStyle;
        if (headers[8]) headers[8].style.display = displayStyle;
    }

    let greenTotal = 0;
    let redTotal = 0;

    data.forEach(item => {
        const deduction = item.deduction || 0;
        const total = item.total || 0;
        const amount = item.amount || 0;
        const rate = item.ratePercent || 0;

        if (item.isVerified) {
            greenTotal += total;
        } else {
            redTotal += total;
        }

        const bankName = item.bank ? (item.bank.bankName || item.bank) : '-';
        const dateStr = new Date(item.date).toISOString().split('T')[0];

        const tr = document.createElement('tr');
        tr.dataset.id = item._id; // Store ID for persistence

        let html = `
            <td>${dateStr}</td>
            <td class="text-center"><input type="checkbox" class="batch-checkbox" value="${item._id}" ${item.isVerified ? 'checked' : ''}></td>
        `;

        if (isDeduction) {
            html += `<td><input type="date" class="form-control form-control-sm border-0 bg-transparent batch-date-input" value="${dateStr}"></td>`;
        } else {
            html += `<td style="display:none"></td>`;
        }

        html += `<td>${bankName}</td>
                 <td>${item.department || '-'}</td>
                 <td>${amount.toLocaleString()}</td>`;

        if (isDeduction) {
            html += `<td>${rate}%</td>
                      <td>${deduction.toLocaleString()}</td>`;
        } else {
            html += `<td style="display:none"></td>
                      <td style="display:none"></td>`;
        }

        html += `<td class="${isDeduction ? '' : 'd-none'} fw-bold">${total.toLocaleString()}</td>
                 <td>${item.remarks || ''}</td>
                 <td>${item.batchNo || ''}</td>`;

        tr.innerHTML = html;
        applyRowColor(tr, item.isVerified);
        tbody.appendChild(tr);
    });

    // Update KPI Displays
    const greenDisplay = document.getElementById('bd-green-total');
    if (greenDisplay) {
        greenDisplay.textContent = Math.round(greenTotal).toLocaleString();
    }

    const redDisplay = document.getElementById('bd-red-total');
    if (redDisplay) {
        redDisplay.textContent = Math.round(redTotal).toLocaleString();
    }
}

// Helper to apply Green/Red styling based on verification status
function applyRowColor(row, isVerified) {
    const cells = row.querySelectorAll('td');
    if (isVerified) {
        // Verified: Green Background, White Text, Normal Weight
        row.style.setProperty('background-color', '#28a745', 'important');
        row.style.setProperty('color', '#fff', 'important');
        row.style.setProperty('font-weight', 'normal', 'important');
        cells.forEach(cell => {
            cell.style.setProperty('background-color', '#28a745', 'important');
            cell.style.setProperty('color', '#fff', 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
        });
    } else {
        // Unverified: Red Background, White Text, Normal Weight
        row.style.setProperty('background-color', '#dc3545', 'important');
        row.style.setProperty('color', '#fff', 'important');
        row.style.setProperty('font-weight', 'normal', 'important');
        cells.forEach(cell => {
            cell.style.setProperty('background-color', '#dc3545', 'important');
            cell.style.setProperty('color', '#fff', 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
        });
    }

    // Force white color and normal font on inputs (date, etc.)
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
        if (input.type !== 'checkbox') {
            input.style.setProperty('color', '#fff', 'important');
            input.style.setProperty('font-weight', 'normal', 'important');
            input.style.setProperty('font-size', '0.9rem', 'important');
        }
    });
}

// Function to recalculate green/red totals from the current screen state
function calculateGridTotals() {
    const rows = document.querySelectorAll('#bankDetailsBody tr');
    let greenTotal = 0;
    let redTotal = 0;

    rows.forEach(row => {
        // ONLY count rows that are visible (not hidden by search)
        if (row.style.display !== 'none') {
            const checkbox = row.querySelector('.batch-checkbox');
            const cells = row.querySelectorAll('td');
            // Column 8 is the "Total" column
            if (cells[8]) {
                const val = parseFloat(cells[8].textContent.replace(/,/g, '')) || 0;
                if (checkbox && checkbox.checked) {
                    greenTotal += val;
                } else {
                    redTotal += val;
                }
            }
        }
    });

    // Update Badges with rounded whole numbers
    const greenDisplay = document.getElementById('bd-green-total');
    if (greenDisplay) greenDisplay.textContent = Math.round(greenTotal).toLocaleString();

    const redDisplay = document.getElementById('bd-red-total');
    if (redDisplay) redDisplay.textContent = Math.round(redTotal).toLocaleString();
}

// Global real-time search filter
function filterBankGrid() {
    const input = document.getElementById('globalSearchInput');
    const filter = input.value.toLowerCase();
    const cleanFilter = filter.replace(/,/g, '');
    const rows = document.querySelectorAll('#bankDetailsBody tr');

    rows.forEach(row => {
        // Extract all text from row cells
        const text = row.innerText.toLowerCase();
        // Remove commas to allow searching for "1234" instead of "1,234"
        const cleanText = text.replace(/,/g, '');

        // Also check input values (like date) which are not in innerText
        const dateInput = row.querySelector('.batch-date-input');
        const dateVal = dateInput ? dateInput.value.toLowerCase() : '';

        if (text.includes(filter) || cleanText.includes(cleanFilter) || dateVal.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });

    // Update totals based on search results
    calculateGridTotals();
}

// Function to handle "Update" button click - Visual Feedback & Persistence
async function updateBankRowsStatus() {
    const isDeduction = document.getElementById('deductionOption').checked;
    const tbody = document.getElementById('bankDetailsBody');
    const rows = tbody.querySelectorAll('tr');
    const updates = [];

    rows.forEach(row => {
        const checkbox = row.querySelector('.batch-checkbox');
        const id = row.dataset.id;
        if (checkbox && id) {
            const dateInput = row.querySelector('.batch-date-input');
            updates.push({
                id: id,
                isVerified: checkbox.checked,
                date: dateInput ? dateInput.value : null
            });
            // Instant visual feedback before save completes
            applyRowColor(row, checkbox.checked);
        }
    });

    // Re-calculate the totals at the top immediately
    calculateGridTotals();

    if (updates.length === 0) return;

    try {
        const token = localStorage.getItem('token');
        const endpoint = isDeduction ? '/api/v1/daily-cash/bulk-verify-status' : '/api/v1/bank-transactions/bulk-verify-status';

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ updates })
        });

        const result = await response.json();
        if (result.success) {
            console.log('Verification status saved successfully');
        } else {
            alert('Failed to save status: ' + result.message);
        }
    } catch (err) {
        console.error('Error saving verification status:', err);
        alert('Error saving status. Please try again.');
    }
}

// --- Tab 2: Pending Cheques ---
async function loadPendingChqData() {
    const branch = document.getElementById('pc-branch').value;
    const bank = document.getElementById('pc-bank').value;

    console.log(`Loading pending chq data for Branch: ${branch}, Bank: ${bank}`);

    // Calculate total bank balance for the selected branch
    await calculateBranchBankBalance(branch);

    // Calculate pending cheque amount (unverified payment entries)
    await calculatePendingChqAmount(branch);

    // Calculate difference
    calculateDiff();

    // Load history from localStorage
    const history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');
    // Filter by selected branch (and bank if selected). Check bankId first, fallback to bank (name/id legacy)
    const filteredHistory = history.filter(h => h.branch === branch && (!bank || h.bankId === bank || h.bank === bank));

    renderPendingChqGrid(filteredHistory);
}

// Calculate Diff = Bank Amount + Pending Chq - Statement
function calculateDiff() {
    const bankAmountInput = document.getElementById('pc-bank-amount');
    const pendingChqInput = document.getElementById('pc-pending-chq');
    const statementInput = document.getElementById('pc-statement');
    const diffInput = document.getElementById('pc-diff');

    if (!bankAmountInput || !pendingChqInput || !statementInput || !diffInput) {
        return;
    }

    const bankAmount = parseFloat(bankAmountInput.value) || 0;
    const pendingChq = parseFloat(pendingChqInput.value) || 0;
    const statement = parseFloat(statementInput.value) || 0;

    const diff = bankAmount + pendingChq - statement;

    diffInput.value = diff.toFixed(2);
}

// Calculate Pending Chq amount - total of unverified (red) payment entries
async function calculatePendingChqAmount(branch) {
    const pendingChqInput = document.getElementById('pc-pending-chq');
    const bankDateInput = document.getElementById('pc-bank-date');

    if (!branch || !pendingChqInput) {
        if (pendingChqInput) pendingChqInput.value = '0';
        return;
    }

    const bankDate = bankDateInput ? bankDateInput.value : null;

    if (!bankDate) {
        pendingChqInput.value = '0';
        return;
    }

    try {
        const token = localStorage.getItem('token');

        // Fetch unverified bank payment transactions (withdrawal/paid type, not verified)
        const endDate = new Date(bankDate);
        endDate.setHours(23, 59, 59, 999);

        const response = await fetch(`/api/v1/bank-transactions?endDate=${endDate.toISOString()}&branch=${branch}&type=withdrawal&excludeRefType=bank_transfer`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            // Sum up unverified (isVerified = false) entries
            // AND ensure we exclude potential Bank Transfers that slipped through query filters
            const pendingTotal = data.data
                .filter(t => !t.isVerified)
                .filter(t => {
                    const desc = (t.narration || t.remarks || '').toLowerCase();
                    // Exclude explicit transfers
                    if (desc.includes('bank transfer') || desc.startsWith('transfer from') || desc.startsWith('transfer to')) {
                        return false;
                    }
                    return true;
                })
                .reduce((sum, t) => sum + (t.amount || 0), 0);

            pendingChqInput.value = pendingTotal.toFixed(2);
        } else {
            pendingChqInput.value = '0';
        }
    } catch (e) {
        console.error('Error calculating pending chq amount:', e);
        pendingChqInput.value = '0';
    }
}

// Calculate total balance of all banks in the selected branch as of the Bank Date
async function calculateBranchBankBalance(branch) {
    const bankAmountInput = document.getElementById('pc-bank-amount');
    const bankDateInput = document.getElementById('pc-bank-date');

    if (!branch || !bankAmountInput) {
        if (bankAmountInput) bankAmountInput.value = '0.00';
        return;
    }

    const bankDate = bankDateInput ? bankDateInput.value : null;

    if (!bankDate) {
        bankAmountInput.value = '0.00';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/reports/bank-ledger/branch-balance?branch=${encodeURIComponent(branch)}&date=${bankDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            bankAmountInput.value = (data.totalBalance || 0).toFixed(2);
        } else {
            console.error('Failed to get branch balance:', data.message);
            bankAmountInput.value = '0.00';
        }
    } catch (e) {
        console.error('Error fetching branch balance:', e);
        bankAmountInput.value = '0.00';
    }
}

function renderPendingChqGrid(data) {
    const tbody = document.getElementById('pendingChqBody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="12" class="text-center text-muted">No pending cheque data available</td>`;
        tbody.appendChild(tr);
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'table-light';

        const formatVal = (val) => parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.dated}</td>
            <td>${row.sysDate}</td>
            <td>${row.branch}</td>
            <td>${row.bank}</td>
            <td>${row.bankDate}</td>
            <td>${row.stmtDate || '-'}</td>
            <td class="text-end">${formatVal(row.ledger)}</td>
            <td class="text-end">${formatVal(row.pending)}</td>
            <td class="text-end">${formatVal(row.statement)}</td>
            <td class="text-end">${formatVal(row.diff)}</td>
            <td class="text-center">
                <button class="btn btn-primary btn-xs" onclick="editPendingChq('${row.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-xs" onclick="deletePendingChq('${row.id}')"><i class="fas fa-trash"></i></button>
            </td>
         `;
        tbody.appendChild(tr);
    });
}

// Edit Pending Chq
window.editPendingChq = async function (id) {
    const history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');
    const record = history.find(h => h.id === id);
    if (!record) return;

    const branchSelect = document.getElementById('pc-branch');

    // Load into form
    if (branchSelect) {
        if (branchSelect.value !== record.branch) {
            branchSelect.value = record.branch;
            // Trigger change to populate banks
            branchSelect.dispatchEvent(new Event('change'));
            // Wait a moment for banks to load/populate
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // For bank, set value by ID. If saved record has no ID, try matching text or value
    if (document.getElementById('pc-bank')) {
        document.getElementById('pc-bank').value = record.bankId || record.bank;
    }

    document.getElementById('pc-bank-date').value = record.bankDate;
    if (document.getElementById('pc-stmt-date')) document.getElementById('pc-stmt-date').value = record.stmtDate || '';

    document.getElementById('pc-bank-amount').value = record.ledger;
    document.getElementById('pc-pending-chq').value = record.pending;
    document.getElementById('pc-statement').value = record.statement;
    document.getElementById('pc-diff').value = record.diff || 0;

    // Delete old record effectively "moving" it to edit state
    // Don't confirm, just do it.
    deletePendingChq(id, false);
}

// Delete Pending Chq
window.deletePendingChq = function (id, confirmDelete = true) {
    if (confirmDelete && !confirm('Are you sure you want to delete this entry?')) return;

    let history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');
    history = history.filter(h => h.id !== id);
    localStorage.setItem('pending_chq_history', JSON.stringify(history));

    loadPendingChqData(); // Reload grid from updated storage
}


// --- Tab 3: Bank Summary Functions ---
async function searchBankSummary() {
    const fromDate = document.getElementById('bs-from-date').value;
    const toDate = document.getElementById('bs-to-date').value;
    const branch = document.getElementById('bs-branch').value;
    const dept = document.getElementById('bs-dept').value;

    // Multi-Select: Get all checked values
    const selectedBanks = Array.from(document.querySelectorAll('#bsBankList .bank-checkbox:checked')).map(cb => cb.value);

    if (!fromDate || !toDate) {
        alert('Please select a date range');
        return;
    }

    try {
        const token = localStorage.getItem('token');

        // 1. Fetch Daily Cash (Batch Transfers)
        let dcUrl = `/api/v1/daily-cash?startDate=${fromDate}&endDate=${toDate}&mode=Bank&hasBank=true`;
        if (branch) dcUrl += `&branch=${branch}`;

        // 2. Fetch Bank Transactions (Deposits/Withdrawals)
        let btUrl = `/api/v1/bank-transactions?startDate=${fromDate}&endDate=${toDate}`;
        if (branch) btUrl += `&branch=${branch}`;

        const [dcResp, btResp] = await Promise.all([
            fetch(dcUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(btUrl, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const dcData = await dcResp.json();
        const btData = await btResp.json();

        if (dcData.success && btData.success) {
            let combinedData = [];

            // Process Daily Cash (Batch Transfers)
            dcData.data.forEach(item => {
                // Filtering
                if (dept && item.department && (item.department._id !== dept && item.department !== dept)) return;
                const itemBankId = (item.bank && item.bank._id) ? item.bank._id : item.bank;
                if (selectedBanks.length > 0 && !selectedBanks.includes(itemBankId)) return;

                const ratePerc = item.deductedAmount || 0;
                const grossBase = (item.totalAmount || 0) + ratePerc;
                const deduction = (grossBase * ratePerc) / 100;
                const netAmount = Math.round(grossBase - deduction);

                combinedData.push({
                    date: item.date,
                    batchTransferDate: item.date, // Use same for now or check if there's a specific field
                    type: 'Batch Transfer',
                    ref: item.batchNo || '-',
                    description: item.remarks || 'Daily Cash Deposit',
                    btbWithdraw: 0,
                    btbDeposit: 0,
                    withdraw: 0,
                    batchTransfer: netAmount,
                    deposit: 0,
                    batchNo: item.batchNo || '-',
                    sortDate: new Date(item.date).getTime()
                });
            });

            // Process Bank Transactions
            btData.data.forEach(item => {
                // Filtering
                if (dept && item.department && (item.department._id !== dept && item.department !== dept)) return;
                const itemBankId = (item.bank && item.bank._id) ? item.bank._id : item.bank;

                if (selectedBanks.length > 0) {
                    // Match by ID or by Name (BankTransaction model sometimes has bankName but not bank object)
                    const selectedBankNames = allBanksReference
                        .filter(b => selectedBanks.includes(b._id))
                        .map(b => b.bankName);

                    const itemBankName = item.bankName || (item.bank && item.bank.bankName) || item.bank;

                    if (!selectedBanks.includes(itemBankId) && !selectedBankNames.includes(itemBankName)) return;
                }

                const rawType = (item.transactionType || item.type || '').toLowerCase();
                const isDeposit = rawType === 'deposit' || rawType === 'received';
                const narration = (item.narration || item.remarks || '').toLowerCase();
                const isBTB = item.refType === 'bank_transfer' || narration.includes('bank transfer');

                combinedData.push({
                    date: item.date,
                    batchTransferDate: '-',
                    type: isBTB ? 'Bank Transfer' : (isDeposit ? 'Deposit' : 'Withdrawal'),
                    ref: item.invoiceNo || '-',
                    description: item.narration || item.remarks || '-',
                    btbWithdraw: (isBTB && !isDeposit) ? (item.amount || 0) : 0,
                    btbDeposit: (isBTB && isDeposit) ? (item.amount || 0) : 0,
                    withdraw: (!isBTB && !isDeposit) ? (item.amount || 0) : 0,
                    batchTransfer: 0,
                    deposit: (!isBTB && isDeposit) ? (item.amount || 0) : 0,
                    batchNo: '-',
                    sortDate: new Date(item.date).getTime()
                });
            });

            // Sort by Date Ascending
            combinedData.sort((a, b) => a.sortDate - b.sortDate);

            renderBankSummary(combinedData);
        } else {
            alert('Failed to fetch summary data');
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching summary data');
    }
}

function renderBankSummary(data) {
    const tbody = document.getElementById('bankSummaryBody');
    tbody.innerHTML = '';

    let totalBTBWithdraw = 0;
    let totalBTBDeposit = 0;
    let totalWithdraw = 0;
    let totalBatchTransfer = 0;
    let totalDeposit = 0;

    // Use Opening Balance 0 for now as in the user screenshot
    let runningBalance = 0;

    data.forEach(item => {
        totalBTBWithdraw += item.btbWithdraw;
        totalBTBDeposit += item.btbDeposit;
        totalWithdraw += item.withdraw;
        totalBatchTransfer += item.batchTransfer;
        totalDeposit += item.deposit;

        runningBalance += (item.deposit + item.batchTransfer + item.btbDeposit) - (item.withdraw + item.btbWithdraw);

        const tr = document.createElement('tr');
        // Add specific class for colors if needed
        if (item.type === 'Batch Transfer') tr.className = 'table-success';
        else if (item.type === 'Withdrawal') tr.className = 'table-danger';
        else if (item.type === 'Deposit') tr.className = 'table-info';
        else if (item.type === 'Bank Transfer') tr.className = 'table-warning'; // Light orange/yellow for BTB

        const dateStr = new Date(item.date).toLocaleDateString();
        const btDateStr = item.batchTransferDate !== '-' ? new Date(item.batchTransferDate).toLocaleDateString() : '-';

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${btDateStr}</td>
            <td>${item.type}</td>
            <td>${item.ref}</td>
            <td>${item.description}</td>
            <td class="text-end">${item.btbWithdraw.toLocaleString()}</td>
            <td class="text-end">${item.btbDeposit.toLocaleString()}</td>
            <td class="text-end">${item.withdraw > 0 ? '-' + item.withdraw.toLocaleString() : '0'}</td>
            <td class="text-end">${item.batchTransfer.toLocaleString()}</td>
            <td class="text-end">${item.deposit.toLocaleString()}</td>
            <td class="text-end fw-bold">${runningBalance.toLocaleString()}</td>
            <td>${item.batchNo}</td>
        `;
        tbody.appendChild(tr);
    });

    // Update Footers
    document.getElementById('bs-btb-withdraw-total').textContent = totalBTBWithdraw.toLocaleString();
    document.getElementById('bs-btb-deposit-total').textContent = totalBTBDeposit.toLocaleString();
    document.getElementById('bs-withdraw-total').textContent = totalWithdraw.toLocaleString();
    document.getElementById('bs-batch-transfer-total').textContent = totalBatchTransfer.toLocaleString();
    document.getElementById('bs-deposit-total').textContent = totalDeposit.toLocaleString();
    document.getElementById('bs-final-balance').textContent = runningBalance.toLocaleString();

    // Update KPIs
    document.getElementById('bs-opening-balance').textContent = '0';
    document.getElementById('bs-deposits').textContent = totalDeposit.toLocaleString();
    document.getElementById('bs-batch-received').textContent = totalBatchTransfer.toLocaleString();
    document.getElementById('bs-withdrawal').textContent = totalWithdraw.toLocaleString();
    document.getElementById('bs-btb-withdraw-kpi').textContent = totalBTBWithdraw.toLocaleString();
    document.getElementById('bs-btb-deposit-kpi').textContent = totalBTBDeposit.toLocaleString();
    document.getElementById('bs-closing-balance').textContent = runningBalance.toLocaleString();
}

function filterSummaryGrid() {
    const input = document.getElementById('bs-global-search');
    const filter = input.value.toLowerCase();
    const cleanFilter = filter.replace(/,/g, '');
    const rows = document.querySelectorAll('#bankSummaryBody tr');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const cleanText = text.replace(/,/g, '');

        if (text.includes(filter) || cleanText.includes(cleanFilter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function printBankSummary() {
    window.print();
}

// --- Tab 5: Bank To Bank Functions ---
async function updateBTBBalances() {
    const fromBankId = document.getElementById('btb-from-bank').value;
    const toBankId = document.getElementById('btb-to-bank').value;
    const amount = parseFloat(document.getElementById('btb-amount').value) || 0;

    const fromPreEl = document.getElementById('btb-from-pre');
    const fromNewEl = document.getElementById('btb-from-new');
    const toPreEl = document.getElementById('btb-to-pre');
    const toNewEl = document.getElementById('btb-to-new');

    try {
        const token = localStorage.getItem('token');
        const resp = await fetch('/api/v1/bank-transactions/summary', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();

        if (data.success && data.data.bankBalances) {
            const balances = data.data.bankBalances;

            // Need to get bank names from IDs
            const fromBankName = document.getElementById('btb-from-bank').options[document.getElementById('btb-from-bank').selectedIndex]?.text;
            const toBankName = document.getElementById('btb-to-bank').options[document.getElementById('btb-to-bank').selectedIndex]?.text;

            const fromPre = balances[fromBankName] || 0;
            const toPre = balances[toBankName] || 0;

            fromPreEl.textContent = fromPre.toLocaleString();
            fromNewEl.textContent = (fromPre - amount).toLocaleString();

            toPreEl.textContent = toPre.toLocaleString();
            toNewEl.textContent = (toPre + amount).toLocaleString();
        }
    } catch (e) {
        console.error('Error updating BTB balances:', e);
    }
}

async function saveBankTransfer() {
    const payload = {
        date: document.getElementById('btb-date').value,
        branch: document.getElementById('btb-branch').value,
        fromBank: document.getElementById('btb-from-bank').value,
        toBank: document.getElementById('btb-to-bank').value,
        amount: parseFloat(document.getElementById('btb-amount').value),
        remarks: document.getElementById('btb-remarks').value
    };

    if (!payload.date || !payload.fromBank || !payload.toBank || !payload.amount) {
        alert('Please fill all required fields');
        return;
    }

    if (payload.fromBank === payload.toBank) {
        alert('From and To banks must be different');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const resp = await fetch('/api/v1/bank-transfers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (data.success) {
            alert('Transfer saved successfully');
            clearBTBForm();
            loadBTBTransfers();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Failed to save transfer');
    }
}

async function loadBTBTransfers() {
    const from = document.getElementById('btb-filter-from').value;
    const to = document.getElementById('btb-filter-to').value;

    try {
        const token = localStorage.getItem('token');
        let url = '/api/v1/bank-transfers';
        if (from && to) url += `?startDate=${from}&endDate=${to}`;

        const resp = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();

        if (data.success) {
            renderBTBGrid(data.data);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderBTBGrid(data) {
    const tbody = document.getElementById('btbGridBody');
    tbody.innerHTML = '';
    let total = 0;

    data.forEach(item => {
        total += item.amount;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(item.date).toLocaleDateString()}</td>
            <td>${item.fromBank?.bankName || 'N/A'}</td>
            <td>${item.toBank?.bankName || 'N/A'}</td>
            <td class="text-end">${item.amount.toLocaleString()}</td>
            <td>${item.remarks || ''}</td>
            <td class="text-center">
                <button class="btn btn-danger btn-sm" onclick="deleteBankTransfer('${item._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('btb-total-amount').textContent = total.toLocaleString();
}

async function deleteBankTransfer(id) {
    if (!confirm('Are you sure you want to delete this transfer? balances will be reversed.')) return;

    try {
        const token = localStorage.getItem('token');
        const resp = await fetch(`/api/v1/bank-transfers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
            alert('Deleted successfully');
            loadBTBTransfers();
        } else {
            alert(data.message);
        }
    } catch (e) {
        console.error(e);
    }
}

function clearBTBForm() {
    document.getElementById('btb-from-bank').value = '';
    document.getElementById('btb-to-bank').value = '';
    document.getElementById('btb-amount').value = '';
    document.getElementById('btb-remarks').value = '';
    document.getElementById('btb-from-pre').textContent = '0';
    document.getElementById('btb-from-new').textContent = '0';
    document.getElementById('btb-to-pre').textContent = '0';
    document.getElementById('btb-to-new').textContent = '0';
}

function filterBTBGrid() {
    const input = document.getElementById('btb-search');
    const filter = input.value.toLowerCase();
    const cleanFilter = filter.replace(/,/g, '');
    const rows = document.querySelectorAll('#btbGridBody tr');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const cleanText = text.replace(/,/g, '');
        row.style.display = (text.includes(filter) || cleanText.includes(cleanFilter)) ? '' : 'none';
    });
}

// --- Helper Utils ---
function getSearchParams(scope) {
    return {
        fromDate: scope.querySelector('.from-date')?.value,
        toDate: scope.querySelector('.to-date')?.value,
        branch: scope.querySelector('.branch-select')?.value,
        dept: scope.querySelector('.dept-select')?.value,
        bank: scope.querySelector('.bank-select')?.value
    };
}

function formatDateForInput(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    return '';
}

// --- Exported functions for global access ---
window.searchBankDetails = searchBankDetails;
window.loadPendingChqData = loadPendingChqData;
window.editPendingChq = editPendingChq;
window.deletePendingChq = deletePendingChq;
window.calculateDiff = calculateDiff;
window.updateBankRowsStatus = updateBankRowsStatus;
window.calculateGridTotals = calculateGridTotals;
window.filterBankGrid = filterBankGrid;
window.applyRowColor = applyRowColor;
window.searchBankSummary = searchBankSummary;
window.filterSummaryGrid = filterSummaryGrid;
window.printBankSummary = printBankSummary;
window.updateBTBBalances = updateBTBBalances;
window.saveBankTransfer = saveBankTransfer;
window.loadBTBTransfers = loadBTBTransfers;
window.deleteBankTransfer = deleteBankTransfer;
window.clearBTBForm = clearBTBForm;
window.filterBTBGrid = filterBTBGrid;

// Print Bank Ledger Function
function printBankLedger() {
    window.print();
}

window.printBankLedger = printBankLedger;
