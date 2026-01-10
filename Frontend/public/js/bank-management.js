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
    await populateBDBank(); // Load grouped banks for Bank Detail tab
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

    // Listen for global data updates
    window.addEventListener('bank-data-updated', () => {
        console.log('Bank data updated, refreshing active tab...');
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab) {
            refreshTab(activeTab.id);
        }
    });

    // Tab Activation Listeners
    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            const target = e.target.getAttribute('data-bs-target'); // e.g. #bank-detail
            const id = target.replace('#', '');
            refreshTab(id);
        });
    });

    function refreshTab(id) {
        if (id === 'bank-to-bank') {
            if (window.loadBTBTransfers) window.loadBTBTransfers();
        } else if (id === 'bank-detail') {
            // Only search if dates are selected (default behavior)
            const from = document.getElementById('bd-from-date').value;
            const to = document.getElementById('bd-to-date').value;
            if (from && to && window.searchBankDetails) {
                window.searchBankDetails();
            }
        } else if (id === 'bank-summary') {
            const from = document.getElementById('pro-from-date').value;
            const to = document.getElementById('pro-to-date').value;
            if (from && to && window.fetchProReport) {
                window.fetchProReport();
            }
        } else if (id === 'bank-payments') {
            if (window.loadBankPayments) window.loadBankPayments();
        } else if (id === 'pending-chq') {
            if (window.loadPendingChqData) window.loadPendingChqData();
        }
    }

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
        const userStr = localStorage.getItem('user');
        let user = null;
        if (userStr) {
            try { user = JSON.parse(userStr); } catch (e) { console.error('Error parsing user', e); }
        }

        const response = await fetch('/api/v1/stores', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success) {
            allBranches = data.data;

            // Permission Filter
            // If user is not admin, filter branches
            if (user && user.role !== 'admin' && user.branch && Array.isArray(user.branch) && user.branch.length > 0) {
                // user.branch is likely an array of IDs or Names
                allBranches = allBranches.filter(b => user.branch.includes(b._id) || user.branch.includes(b.name));
            } else if (user && user.role !== 'admin' && user.branch && typeof user.branch === 'string') {
                // Handle legacy single branch case
                allBranches = allBranches.filter(b => b._id === user.branch || b.name === user.branch);
            }

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
                // IMPORTANT: If we filtered down to 1 (restricted user), auto-select it.
                if (allBranches.length === 1) {
                    sel.value = allBranches[0].name;
                    sel.dispatchEvent(new Event('change'));
                }
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
    // Custom Multi-Select Logic for Bank Summary Tab only (Bank Detail uses grouped dropdown)
    if (scopeElement.id === 'bank-summary') {
        populateBankMultiSelect(scopeElement);
    }

    // Skip Bank Detail tab - it uses grouped dropdown populated by populateBDBank()
    if (scopeElement.id === 'bank-detail') {
        return;
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
    // Get selected bank group and extract IDs from data-ids attribute
    let selectedBanks = [];
    const bankSelect = document.getElementById('bd-bank-select');
    if (bankSelect && bankSelect.value) {
        const selectedOpt = bankSelect.options[bankSelect.selectedIndex];
        if (selectedOpt && selectedOpt.dataset.ids) {
            // Grouped bank selected (Easypaisa or Branch Bank)
            selectedBanks = selectedOpt.dataset.ids.split(',');
        }
    }

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
            url = `/api/v1/bank-transactions?startDate=${fromDate}&endDate=${toDate}&excludeRefType=bank_transfer&limit=0`;
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
                    // Ensure strict boolean
                    isVerified: (item.isVerified === true || item.isVerified === 'true' || item.isVerified === 1),
                    verifiedDate: item.verifiedDate, // Map new field
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

            // Sort: Unverified (Red) on top, Verified (Green) at bottom. Both sorted by Date Ascending.
            mappedData.sort((a, b) => {
                const vA = a.isVerified ? 1 : 0;
                const vB = b.isVerified ? 1 : 0;

                // 1. Primary Sort: Verification Status
                // 0 (Unverified) comes before 1 (Verified)
                if (vA !== vB) {
                    return vA - vB;
                }

                // 2. Secondary Sort: Date Ascending
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateA - dateB;
            });

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
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toISOString().split('T')[0]; // yyyy-mm-dd for Input

        // Format Display Date as dd-mm-yyyy
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const displayDate = `${day}-${month}-${year}`;

        // Default Input Date: Use Verified Date if exists, else Original Date
        let inputDateValue = dateStr;
        if (item.verifiedDate) {
            inputDateValue = new Date(item.verifiedDate).toISOString().split('T')[0];
        } else if (item.isVerified) {
            // If marked verified but no verifiedDate (legacy), use dateStr
            inputDateValue = dateStr;
        }

        const tr = document.createElement('tr');
        tr.dataset.id = item._id; // Store ID for persistence

        let html = `
            <td>${displayDate}</td>
            <td class="text-center"><input type="checkbox" class="batch-checkbox" value="${item._id}" ${item.isVerified ? 'checked' : ''}></td>
        `;

        if (isDeduction) {
            html += `<td><input type="date" class="form-control form-control-sm border-0 bg-transparent batch-date-input" value="${inputDateValue}"></td>`;
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
                verifiedDate: dateInput ? dateInput.value : null
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
    const branchInput = document.getElementById('pc-branch');
    if (!branchInput) return; // Exit if old UI elements are missing

    const branch = branchInput.value;
    const bank = document.getElementById('pc-bank').value;

    console.log(`Loading pending chq data for Branch: ${branch}, Bank: ${bank}`);

    // Calculate total bank balance for the selected branch (Uses Final Client-Side Aggregation)
    await calculateBranchBalanceFinal(branch);

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

        const response = await fetch(`/api/v1/bank-transactions?endDate=${endDate.toISOString()}&branch=${branch}&type=withdrawal&excludeRefType=bank_transfer&limit=0`, {
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
                    // Exclude specific banks as per user request
                    const bankName = (t.bankName || t.bank || '').toUpperCase();
                    if (bankName.includes('EASYPAISA (MED)') || bankName.includes('EASYPAISA (GRO)')) {
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
// Calculate total balance of all banks in the selected branch as of the Bank Date (Client-Side Aggregation)
async function calculateBranchBalanceFinal(branch) {
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

    // Visual indicator that calculation started
    bankAmountInput.value = "Calculating...";

    try {
        const token = localStorage.getItem('token');
        // Aggregating from 2000-01-01 to ensure full history
        const startDate = '2000-01-01';
        const endDate = new Date(bankDate);
        endDate.setHours(23, 59, 59, 999);
        const endStr = endDate.toISOString();

        // 0. Get All Banks in this Branch (Needed for filtering transfers)
        // We include *all* banks (no exclusions) to match "ALL SUM" requirement.
        const bankRes = await fetch(`/api/v1/banks?branch=${encodeURIComponent(branch)}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const bankData = await bankRes.json();
        const branchBankIds = new Set();
        if (bankData.success && bankData.data) {
            bankData.data.forEach(b => branchBankIds.add(b._id));
        }

        // 1. Fetch Daily Cash (Batch Transfers)
        const dcUrl = `/api/v1/daily-cash?startDate=${startDate}&endDate=${endStr}&mode=Bank&hasBank=true&branch=${encodeURIComponent(branch)}&limit=0&_t=${Date.now()}`;
        const dcRes = await fetch(dcUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        const dcData = await dcRes.json();

        let dcTotal = 0;
        if (dcData.success && dcData.data) {
            dcTotal = dcData.data.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
        }

        // 2. Fetch Bank Transactions
        // Note: Check if the API supports 'limit=0' for all records. Assuming yes based on usage.
        const btUrl = `/api/v1/bank-transactions?startDate=${startDate}&endDate=${endStr}&branch=${encodeURIComponent(branch)}&limit=0&_t=${Date.now()}`;
        const btRes = await fetch(btUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        const btData = await btRes.json();

        let btTotal = 0;
        if (btData.success && btData.data) {
            btTotal = btData.data.reduce((sum, item) => {
                const type = (item.type || '').toLowerCase();
                const transType = (item.transactionType || '').toLowerCase();
                const isDeposit = type === 'deposit' || type === 'received' || transType === 'deposit' || transType === 'received';
                return isDeposit ? sum + (item.amount || 0) : sum - (item.amount || 0);
            }, 0);
        }

        // 3. Fetch Bank Transfers (Crucial for Inter-Bank/Main-Branch movements)
        // We fetch ALL transfers appearing in this date range and filter client-side 
        // because the API might not support filtering by "Branch of Bank".
        const transUrl = `/api/v1/bank-transfers?startDate=${startDate}&endDate=${endStr}&limit=0&_t=${Date.now()}`;
        const transRes = await fetch(transUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        const transData = await transRes.json();

        let transTotal = 0;
        if (transData.success && transData.data) {
            transData.data.forEach(t => {
                const fromId = t.fromBank?._id || t.fromBank;
                const toId = t.toBank?._id || t.toBank;

                // If funds CAME TO a bank in this branch -> ADD
                if (branchBankIds.has(toId)) {
                    transTotal += (t.amount || 0);
                }
                // If funds WENT FROM a bank in this branch -> SUBTRACT
                if (branchBankIds.has(fromId)) {
                    transTotal -= (t.amount || 0);
                }
            });
        }

        const totalBalance = dcTotal + btTotal + transTotal;
        console.log('Client-Side Branch Calc (Enhanced):', {
            branch,
            banksCount: branchBankIds.size,
            dcTotal,
            btTotal,
            transTotal,
            totalBalance
        });

        bankAmountInput.value = totalBalance.toFixed(2);

        if (window.calculateDiff) window.calculateDiff();

    } catch (e) {
        console.error('Error fetching branch balance (client-side):', e);
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
    const typeFilter = document.getElementById('bs-type').value; // Get Type Filter

    // Multi-Select: Get all checked values
    const selectedBanks = Array.from(document.querySelectorAll('#bsBankList .bank-checkbox:checked')).map(cb => cb.value);

    if (!fromDate || !toDate) {
        alert('Please select a date range');
        return;
    }

    try {
        const token = localStorage.getItem('token');

        // Fetch Opening Balance from API
        let openingBalanceUrl = `/api/v1/reports/bank-ledger/summary-opening-balance?startDate=${fromDate}`;
        if (branch) openingBalanceUrl += `&branch=${encodeURIComponent(branch)}`;
        if (selectedBanks.length > 0) openingBalanceUrl += `&bankIds=${selectedBanks.join(',')}`;

        console.log('Opening Balance URL:', openingBalanceUrl);

        const openingBalanceResp = await fetch(openingBalanceUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const openingBalanceData = await openingBalanceResp.json();
        console.log('Opening Balance Response:', openingBalanceData);
        const openingBalance = openingBalanceData.success ? (openingBalanceData.openingBalance || 0) : 0;
        console.log('Opening Balance:', openingBalance);

        // 1. Fetch Daily Cash (Batch Transfers)
        let dcUrl = `/api/v1/daily-cash?startDate=${fromDate}&endDate=${toDate}&mode=Bank&hasBank=true`;
        if (branch) dcUrl += `&branch=${branch}`;

        // 2. Fetch Bank Transactions (Deposits/Withdrawals) check
        // Use filtered date query if available, but for now stick to main date range
        // IMPORTANT: We use Date range for query, but prefer ChequeDate for display.
        // To catch all possible effective dates, we might need a wider query or specific cheque parameters.
        // Using startChqDate/endChqDate ensures we get items effectively in this range.
        let btUrl = `/api/v1/bank-transactions?startChqDate=${fromDate}&endChqDate=${toDate}&limit=0&useEffectiveDate=true`;
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
            // Filter: Only process if type is 'All' or 'Batch Transfer'
            if (typeFilter === 'all' || typeFilter === 'Batch Transfer') {
                dcData.data.forEach(item => {
                    // Filtering
                    if (dept && item.department && (item.department._id !== dept && item.department !== dept)) return;
                    const itemBankId = (item.bank && item.bank._id) ? item.bank._id : item.bank;
                    if (selectedBanks.length > 0 && !selectedBanks.includes(itemBankId)) return;

                    combinedData.push({
                        date: item.date,
                        batchTransferDate: item.date,
                        type: 'Batch Transfer',
                        ref: item.batchNo || '-',
                        description: `Batch Transfer - ${item.branch ? (item.branch.name || item.branch) : ''}`,
                        btbWithdraw: 0,
                        btbDeposit: 0,
                        withdraw: 0,
                        batchTransfer: item.totalAmount || 0,
                        deposit: 0,
                        batchNo: item.batchNo || '-',
                        sortDate: new Date(item.date).getTime()
                    });
                });
            }

            // Process Bank Transactions
            btData.data.forEach(item => {
                // Filtering
                if (dept && item.department && (item.department._id !== dept && item.department !== dept)) return;
                const itemBankId = (item.bank && item.bank._id) ? item.bank._id : item.bank;

                if (selectedBanks.length > 0) {
                    const selectedBankNames = allBanksReference
                        .filter(b => selectedBanks.includes(b._id))
                        .map(b => b.bankName);

                    const itemBankName = item.bankName || (item.bank && item.bank.bankName) || item.bank;

                    // Fix: Check ID OR Name (Case Insensitive if needed, but strict here)
                    // If ID matches OR Name matches, we include it.
                    const idMatch = selectedBanks.includes(itemBankId);
                    const nameMatch = selectedBankNames.includes(itemBankName);

                    if (!idMatch && !nameMatch) return;
                }

                const rawType = (item.transactionType || item.type || '').toLowerCase();
                const isDeposit = rawType === 'deposit' || rawType === 'received';
                const narration = (item.narration || item.remarks || '').toLowerCase();
                const isBTB = item.refType === 'bank_transfer' || narration.includes('bank transfer');

                // Determine Type String
                let typeStr = isBTB ? 'Bank Transfer' : (isDeposit ? 'Deposit' : 'Withdrawal');

                // Apply Type Filter
                if (typeFilter !== 'all' && typeFilter !== typeStr) return;

                combinedData.push({
                    date: item.chequeDate || item.date,
                    batchTransferDate: '-',
                    type: typeStr,
                    ref: item.invoiceNo || '-',
                    description: item.narration || item.remarks || '-',
                    btbWithdraw: (isBTB && !isDeposit) ? (item.amount || 0) : 0,
                    btbDeposit: (isBTB && isDeposit) ? (item.amount || 0) : 0,
                    withdraw: (!isBTB && !isDeposit) ? (item.amount || 0) : 0,
                    batchTransfer: 0,
                    deposit: (!isBTB && isDeposit) ? (item.amount || 0) : 0,
                    batchNo: '-',
                    sortDate: new Date(item.chequeDate || item.date).getTime()
                });
            });

            // Sort by Date Ascending
            combinedData.sort((a, b) => a.sortDate - b.sortDate);

            renderBankSummary(combinedData, openingBalance);
        } else {
            alert('Failed to fetch summary data');
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching summary data');
    }
}

function renderBankSummary(data, openingBalance = 0) {
    const tbody = document.getElementById('bankSummaryBody');
    tbody.innerHTML = '';

    let totalBTBWithdraw = 0;
    let totalBTBDeposit = 0;
    let totalWithdraw = 0;
    let totalBatchTransfer = 0;
    let totalDeposit = 0;

    // Start with Opening Balance
    let runningBalance = openingBalance;

    // Add Opening Balance row at the top
    const openingRow = document.createElement('tr');
    openingRow.className = 'table-secondary fw-bold';
    openingRow.innerHTML = `
        <td colspan="5">Opening Balance</td>
        <td class="text-end">-</td>
        <td class="text-end">-</td>
        <td class="text-end">-</td>
        <td class="text-end">-</td>
        <td class="text-end">-</td>
        <td class="text-end fw-bold">${openingBalance.toLocaleString()}</td>
        <td>-</td>
    `;
    tbody.appendChild(openingRow);

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

    // Update KPIs with Opening Balance
    document.getElementById('bs-opening-balance').textContent = openingBalance.toLocaleString();
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
    const branch = document.getElementById('btb-branch').value;
    const amount = parseFloat(document.getElementById('btb-amount').value) || 0;

    const fromPreEl = document.getElementById('btb-from-pre');
    const fromNewEl = document.getElementById('btb-from-new');
    const toPreEl = document.getElementById('btb-to-pre');
    const toNewEl = document.getElementById('btb-to-new');

    try {
        const token = localStorage.getItem('token');
        let url = '/api/v1/bank-transactions/summary';
        if (branch) url += `?branch=${encodeURIComponent(branch)}`;

        const resp = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();

        if (data.success) {
            // Need to get bank names from IDs
            const fromBankName = document.getElementById('btb-from-bank').options[document.getElementById('btb-from-bank').selectedIndex]?.text;
            const toBankName = document.getElementById('btb-to-bank').options[document.getElementById('btb-to-bank').selectedIndex]?.text;

            // Calculate balance from summary (Deposit - Withdrawal)
            // summary format: "BankName_deposit": { totalAmount: ... }
            const getBalance = (bankName) => {
                if (!bankName) return 0;
                const depositKey = `${bankName}_deposit`;
                const withdrawKey = `${bankName}_withdrawal`;
                const deposits = data.data.summary[depositKey]?.totalAmount || 0;
                const withdrawals = data.data.summary[withdrawKey]?.totalAmount || 0;
                return deposits - withdrawals;
            };

            const fromPre = getBalance(fromBankName);
            const toPre = getBalance(toBankName);

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

// Filter Bank Summary Grid based on single global search and column dropdown
function filterSummaryGrid() {
    const input = document.getElementById('bs-global-search');
    const colSelect = document.getElementById('bs-search-col');
    const filter = input ? input.value.toLowerCase() : '';
    const colIndex = colSelect ? colSelect.value : 'all';

    const tbody = document.getElementById('bankSummaryBody');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        // Skip filtering the "Opening Balance" row
        if (rows[i].classList.contains('table-secondary') || rows[i].cells[0].innerText.includes('Opening Balance')) {
            continue;
        }

        let textContent = '';
        if (colIndex === 'all') {
            textContent = rows[i].textContent.toLowerCase();
        } else {
            // Target specific cell
            const cell = rows[i].getElementsByTagName('td')[parseInt(colIndex)];
            if (cell) {
                textContent = cell.textContent.toLowerCase();
            }
        }

        if (textContent.includes(filter)) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}
window.filterSummaryGrid = filterSummaryGrid;


// --- Tab 3: Bank Summary (Professional) Logic ---

// Variable to store filtered banks for Pro View
let allBanksPro = [];

async function loadProBanks() {
    try {
        const branchSelect = document.getElementById('pro-branch');
        const branchingVal = branchSelect ? branchSelect.value : '';
        const token = localStorage.getItem('token');

        let url = '/api/v1/banks';
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (data.success) {
            allBanksPro = data.data;
            renderProBankList(branchingVal);

            const branchBanks = allBanksPro.filter(b => {
                if (!branchingVal) return true;
                if (b.branch && typeof b.branch === 'object') return b.branch.name === branchingVal;
                return b.branch === branchingVal;
            });

            const uniqueDeptIds = new Set();
            branchBanks.forEach(b => {
                if (b.department) {
                    // Safe string conversion for ObjectId or String
                    const idStr = (typeof b.department === 'object' && b.department._id) ? String(b.department._id) : String(b.department);
                    uniqueDeptIds.add(idStr);
                }
            });

            // Now populate departments filtering by these IDs
            populateProDepartments(Array.from(uniqueDeptIds));
        }
    } catch (e) { console.error('Error loading pro banks', e); }
}

function renderProBankList(branchName) {
    const select = document.getElementById('pro-bank-select');
    if (!select) return;

    select.innerHTML = '<option value="">All Banks</option>';

    // Filter
    const filtered = allBanksPro.filter(b => {
        if (!branchName) return true;
        if (b.branch && typeof b.branch === 'object') return b.branch.name === branchName;
        return b.branch === branchName;
    });

    const epIds = [];
    const bbIds = [];

    filtered.forEach(b => {
        const name = (b.bankName || '').toUpperCase();
        if (name.includes('EASYPAISA')) {
            epIds.push(b._id);
        } else {
            bbIds.push(b._id);
        }
    });

    if (epIds.length > 0) {
        const opt = document.createElement('option');
        opt.value = 'GROUP_EP';
        opt.textContent = 'Easypaisa';
        opt.dataset.ids = epIds.join(',');
        select.appendChild(opt);
    }

    if (bbIds.length > 0) {
        const opt = document.createElement('option');
        opt.value = 'GROUP_BB';
        opt.textContent = 'Branch Bank';
        opt.dataset.ids = bbIds.join(',');
        select.appendChild(opt);
    }
}

// Populate Bank Detail Bank Dropdown with Grouped Banks
async function populateBDBank() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/banks', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (data.success) {
            const select = document.getElementById('bd-bank-select');
            if (!select) return;

            select.innerHTML = '<option value="">All Banks</option>';

            const epIds = [];
            const bbIds = [];

            data.data.forEach(b => {
                const name = (b.bankName || '').toUpperCase();
                if (name.includes('EASYPAISA')) {
                    epIds.push(b._id);
                } else {
                    bbIds.push(b._id);
                }
            });

            if (epIds.length > 0) {
                const opt = document.createElement('option');
                opt.value = 'GROUP_EP';
                opt.textContent = 'Easypaisa';
                opt.dataset.ids = epIds.join(',');
                select.appendChild(opt);
            }

            if (bbIds.length > 0) {
                const opt = document.createElement('option');
                opt.value = 'GROUP_BB';
                opt.textContent = 'Branch Bank';
                opt.dataset.ids = bbIds.join(',');
                select.appendChild(opt);
            }
        }
    } catch (e) {
        console.error('Error loading BD banks', e);
    }
}


// Make functions globally accessible
window.loadProBanks = loadProBanks;
window.toggleAllBanksPro = function (source) {
    const checkboxes = document.querySelectorAll('.bank-checkbox-pro');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateProBankButtonLabel();
}
window.updateProBankButtonLabel = updateProBankButtonLabel; // Assign function

function updateProBankButtonLabel() {
    const checked = document.querySelectorAll('.bank-checkbox-pro:checked');
    const total = document.querySelectorAll('.bank-checkbox-pro');
    const btn = document.getElementById('bankDropdownBtn');

    if (!btn) return;

    if (checked.length === 0) {
        btn.innerText = 'Select Banks (All)';
    } else if (checked.length === total.length && total.length > 0) {
        btn.innerText = 'All Banks';
    } else {
        btn.innerText = `${checked.length} Selected`;
    }
}

// Pro Report Fetcher
window.fetchProReport = async function () {
    const fromDate = document.getElementById('pro-from-date').value;
    const toDate = document.getElementById('pro-to-date').value;
    const branch = document.getElementById('pro-branch').value;
    const dept = document.getElementById('pro-dept').value;
    const type = document.getElementById('pro-type').value;

    // Logic to collect IDs from Select Dropdown
    let selectedBankIds = [];
    const bankSelect = document.getElementById('pro-bank-select');
    if (bankSelect && bankSelect.value) {
        // If a group is selected, get IDs from dataset
        const selectedOpt = bankSelect.options[bankSelect.selectedIndex];
        if (selectedOpt && selectedOpt.dataset.ids) {
            selectedBankIds = selectedOpt.dataset.ids.split(',');
        }
    }

    if (!fromDate || !toDate) {
        alert('Please select a date range');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        let url = `/api/v1/reports/bank-ledger/pro-summary?startDate=${fromDate}&endDate=${toDate}`;
        if (branch) url += `&branch=${encodeURIComponent(branch)}`;
        if (selectedBankIds.length > 0) url += `&bankIds=${selectedBankIds.join(',')}`;
        if (dept) url += `&department=${dept}`;
        if (type) url += `&type=${encodeURIComponent(type)}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            renderProKPIs(data.data);
            renderProTable(data.data.transactions, data.data.openingBalance);
            // Grouped summary removed
        } else {
            alert(data.message || 'Error fetching report');
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching report');
    }
}

function renderProKPIs(data) {
    const totalDeposit = data.transactions.reduce((sum, t) => sum + (t.deposit || 0), 0);
    const totalWithdrawal = data.transactions.reduce((sum, t) => sum + (t.withdrawal || 0), 0);

    const kpiOpen = document.getElementById('kpi-opening');
    if (kpiOpen) kpiOpen.innerText = formatCurrencyPro(data.openingBalance);

    const kpiDep = document.getElementById('kpi-deposit');
    if (kpiDep) kpiDep.innerText = formatCurrencyPro(totalDeposit);

    const kpiWith = document.getElementById('kpi-withdrawal');
    if (kpiWith) kpiWith.innerText = formatCurrencyPro(totalWithdrawal);

    const kpiClose = document.getElementById('kpi-closing');
    if (kpiClose) kpiClose.innerText = formatCurrencyPro(data.closingBalance);
}

function renderProTable(transactions, openingBalance) {
    const tbody = document.getElementById('proTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Add Opening Balance Row
    const openRow = document.createElement('tr');
    openRow.classList.add('table-light', 'fw-bold');
    openRow.innerHTML = `
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>Opening Balance</td>
        <td>-</td>
        <td>Opening Balance Brought Forward</td>
        <td class="text-end">-</td>
        <td class="text-end">-</td>
        <td class="text-end">${formatCurrencyPro(openingBalance)}</td>
        <td>-</td>
    `;
    tbody.appendChild(openRow);

    transactions.forEach(t => {
        const tr = document.createElement('tr');

        // Color Coding
        if (t.type === 'Deposit') tr.classList.add('row-deposit');
        else if (t.type === 'Withdrawal') tr.classList.add('row-withdrawal');
        else if (t.type === 'Bank Transfer') tr.classList.add('row-transfer');
        else if (t.type === 'Batch Transfer') tr.classList.add('row-deposit');

        tr.innerHTML = `
            <td>${formatDatePro(t.date)}</td>
            <td>${formatDatePro(t.effectiveDate)}</td>
            <td>${t.bankName || '-'}</td>
            <td>${t.type}</td>
            <td>${t.ref}</td>
            <td>${t.description}</td>
            <td class="text-end text-success fw-bold">${t.deposit ? formatCurrencyPro(t.deposit) : '-'}</td>
            <td class="text-end text-danger fw-bold">${t.withdrawal ? formatCurrencyPro(t.withdrawal) : '-'}</td>
            <td class="text-end fw-bold">${formatCurrencyPro(t.balance)}</td>
            <td><span class="badge ${t.status === 'Verified' ? 'bg-success' : 'bg-warning text-dark'}">${t.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

window.filterProTable = function () {
    const input = document.getElementById('pro-search');
    const filter = input.value.toLowerCase();
    const rows = document.getElementById('proTableBody').getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        // Always show Opening Balance Row
        if (rows[i].cells[3] && rows[i].cells[3].innerText === 'Opening Balance') {
            rows[i].style.display = "";
            continue;
        }

        const text = rows[i].textContent.toLowerCase();
        if (text.includes(filter)) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}

// Helpers
function formatCurrencyPro(amount) {
    if (amount === undefined || amount === null) return '0';
    return new Intl.NumberFormat('en-US').format(amount);
}
function formatDatePro(dateStr) {
    if (!dateStr) return '-';
    // Stick to basic string manipulation for ISO dates or use utility
    return new Date(dateStr).toLocaleDateString('en-GB');
}

// Initializer for Pro Tab (called when Tab is shown or page loaded if this is active tab)
function initProSummary() {
    // Populate Pro View specific dropdowns
    // Branches - reuse existing logic but fill #pro-branch
    populateProBranches();

    // Departments
    populateProDepartments();

    // Banks
    loadProBanks();

    // Dates
    const todayT = new Date();

    const f = document.getElementById('pro-from-date');
    const t = document.getElementById('pro-to-date');
    if (f && !f.value) f.valueAsDate = todayT;
    if (t && !t.value) t.valueAsDate = todayT;
}

async function populateProBranches() {
    try {
        const token = localStorage.getItem('token');
        // Fetch Stores (Branches)
        const res = await fetch('/api/v1/stores', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('pro-branch');
            if (!select) return;

            // Only show "All Branches" if multiple branches exist
            if (data.data.length > 1) {
                select.innerHTML = '<option value="">All Branches</option>';
            } else {
                select.innerHTML = '';
            }

            data.data.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store.name;
                opt.textContent = store.name; // Use Name
                select.appendChild(opt);
            });

            // Auto-select if only one branch available
            if (data.data.length === 1) {
                select.value = data.data[0].name;
                select.dispatchEvent(new Event('change'));
            }
        }
    } catch (e) { console.error(e); }
}

async function populateProDepartments(allowedDeptIds = null) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/departments', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('pro-dept');
            if (!select) return;
            select.innerHTML = '<option value="">All Departments</option>';
            data.data.forEach(d => {
                let shouldShow = true;

                if (allowedDeptIds !== null && Array.isArray(allowedDeptIds)) {
                    if (!allowedDeptIds.includes(d._id)) {
                        shouldShow = false;
                    }
                }

                if (shouldShow) {
                    const opt = document.createElement('option');
                    opt.value = d._id;
                    opt.textContent = d.name;
                    select.appendChild(opt);
                }
            });
        }
    } catch (e) { console.error(e); }
}

// Wire up Tab Shown event to Init (Add to DOMContentLoaded or Global)
document.addEventListener('DOMContentLoaded', () => {
    const tabEl = document.querySelector('button[data-bs-target="#bank-summary"]');
    if (tabEl) {
        tabEl.addEventListener('shown.bs.tab', function (event) {
            initProSummary();
        });
    }
    // Also if it's the default active tab
    if (document.querySelector('#bank-summary').classList.contains('active')) {
        initProSummary();
    }
});
