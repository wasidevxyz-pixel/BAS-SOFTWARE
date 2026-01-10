// Run initialize immediately if the DOM is already ready
console.log("Pending Cheque V2 Script Loading...");

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProPendingCheque);
} else {
    initProPendingCheque();
}

let currentBranchBanks = new Set();

function initProPendingCheque() {
    console.log("Pending Cheque V2 Initializing...");
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const bankDateEl = document.getElementById('new-bank-date');
    const stmtDateEl = document.getElementById('new-stmt-date');

    if (bankDateEl) bankDateEl.value = today;
    if (stmtDateEl) stmtDateEl.value = today;

    // Attach listeners safely
    const branchEl = document.getElementById('new-branch');
    if (branchEl) {
        branchEl.addEventListener('change', handleProBranchChange);
        console.log("Branch listener attached");
    } else {
        console.error("Critical: #new-branch element not found!");
    }

    if (bankDateEl) bankDateEl.addEventListener('change', calculateProAll);

    const stmtInput = document.getElementById('new-statement');
    if (stmtInput) {
        stmtInput.addEventListener('input', calculateProDiff);
        stmtInput.addEventListener('keyup', calculateProDiff);
        stmtInput.addEventListener('change', calculateProDiff);
    }

    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', calculateProAll);

    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.addEventListener('click', saveProPendingChqRecord);

    // Initial Load
    loadProBranches();
    loadProHistory();
}

async function loadProBranches() {
    const select = document.getElementById('new-branch');
    if (!select) {
        console.error("loadProBranches: #new-branch not found");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        console.log("loadProBranches: Fetching stores with token length", token ? token.length : 'null');
        const res = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("loadProBranches: Fetch status", res.status);
        const data = await res.json();
        console.log("loadProBranches: Data received", data);

        if (data.success && data.data && data.data.length > 0) {

            // Only show "Select Branch..." if multiple branches exist
            if (data.data.length > 1) {
                select.innerHTML = '<option value="">Select Branch...</option>';
            } else {
                select.innerHTML = '';
            }

            data.data.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store.name;
                opt.textContent = store.name; // This is from database 'name' field
                select.appendChild(opt);
            });
            console.log(`Loaded ${data.data.length} branches from database.`);

            // Auto-select if only one branch available
            if (data.data.length === 1) {
                select.value = data.data[0].name;
                // Trigger change to load banks
                select.dispatchEvent(new Event('change'));
            }
        } else {
            console.warn("No branches found in database (Store collection).");
        }
    } catch (e) {
        console.error("Error loading branches from database", e);
        alert("Failed to load branches from database. Please check connection.");
    }
}
// Removed fallback logic to strictly use database
function useFallbackBranches(select) {
    // Deprecated
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function toggleBreakdown() {
    const el = document.getElementById('breakdown-panel');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

async function handleProBranchChange() {
    const branch = document.getElementById('new-branch').value;

    // Load Banks for dropdown (visual only, calc uses all)
    // Even if empty branch, we might want to clear or similar
    if (branch) {
        await loadBanks(branch);
        await calculateProAll();
    }

    loadProHistory();
}

// Calculate Diff = Bank Amount + Pending Chq - Statement
// Calculate Diff = Bank Amount + Pending Chq - Statement
function calculateProDiff() {
    const bankAmtVal = document.getElementById('new-bank-amount').value || '0';
    const pendingAmtVal = document.getElementById('new-pending-chq').value || '0';
    const stmtAmtVal = document.getElementById('new-statement').value || '0';

    // Remove any commas or spaces
    const cleanNum = (str) => {
        if (!str) return 0;
        return parseFloat(String(str).replace(/,/g, '').replace(/\s/g, '')) || 0;
    };

    const bankAmt = cleanNum(bankAmtVal);
    const pendingAmt = cleanNum(pendingAmtVal);
    const stmtAmt = cleanNum(stmtAmtVal);

    console.log(`[CalcProDiff] Bank: ${bankAmt}, Pending: ${pendingAmt}, Stmt: ${stmtAmt}`);

    // Formula: Bank Amount + Pending Cheque - Statement Amount
    const diff = (bankAmt + pendingAmt) - stmtAmt;
    console.log(`[CalcProDiff] Result: ${diff}`);

    // UI Updates
    const diffEl = document.getElementById('new-diff');
    if (diffEl) {
        diffEl.value = diff.toFixed(2);

        if (Math.abs(diff) < 0.1) {
            diffEl.className = 'form-control amount-input bg-amount-green';
        } else {
            diffEl.className = 'form-control amount-input bg-amount-red';
        }
    }
}

async function loadBanks(branch) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/banks?branch=${encodeURIComponent(branch)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const select = document.getElementById('new-bank');
        select.innerHTML = '<option value="">All Banks</option>';
        currentBranchBanks.clear();

        if (data.success && data.data) {
            // Client-side Double Check Filter
            const filtered = data.data.filter(b => !b.branch || b.branch === branch);

            // If backend filter works, filtered count should match data.data count.
            // If strict client side needed:
            const listToUse = filtered.length > 0 ? filtered : data.data;

            listToUse.forEach(bank => {
                const opt = document.createElement('option');
                opt.value = bank._id;
                opt.textContent = bank.bankName + (bank.accountNumber ? ` (${bank.accountNumber})` : '');
                select.appendChild(opt);
                currentBranchBanks.add(bank._id);
            });
            console.log(`Loaded ${listToUse.length} banks for branch ${branch}`);
        }

        // LOCK the dropdown as requested by user
        select.disabled = true;

    } catch (e) {
        console.error("Error loading banks", e);
    }
}

async function calculateProAll() {
    const branch = document.getElementById('new-branch').value;
    const date = document.getElementById('new-bank-date').value;
    const btnRefresh = document.getElementById('btn-refresh');

    if (!branch || !date) return;

    // showLoading(true); // Removing full screen blocker
    if (btnRefresh) {
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Refreshing...';
        btnRefresh.disabled = true;
    }

    try {
        await Promise.all([
            calculateBankAmount(branch, date),
            calculatePendingChq(branch, date)
        ]);
        calculateProDiff();
    } catch (e) {
        console.error("Calculation Error", e);
        alert("Error calculating values. Check console.");
    } finally {
        // showLoading(false);
        if (btnRefresh) {
            btnRefresh.innerHTML = '<i class="fas fa-sync-alt me-2"></i> Refresh Data';
            btnRefresh.disabled = false;
        }
    }
}
//... skipping lines ...
// Add global exposure for debugging
window.calculateProDiff = calculateProDiff;
window.toggleBreakdown = toggleBreakdown;
window.initProPendingCheque = initProPendingCheque;
window.loadProBranches = loadProBranches;

async function calculateBankAmount(branch, dateStr) {
    const token = localStorage.getItem('token');
    const startDate = '2000-01-01';
    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);
    const endIso = endDate.toISOString();

    console.log(`[Calc] Starting Bank Amount Calc for ${branch} until ${endIso}`);

    // Ensure banks are loaded and filter out Easypaisa if requested
    if (currentBranchBanks.size === 0) {
        await loadBanks(branch);
    }

    // Create a Set of Valid Bank IDs (Excluding Easypaisa)
    // We need to fetch the full bank objects again or iterate the DOM options? 
    // Better to re-fetch or use a global map. `loadBanks` populates `currentBranchBanks` (all IDs).
    // Let's rely on fetching the banks list again here for safety and filtering.
    const bankRes = await fetch(`/api/v1/banks?branch=${encodeURIComponent(branch)}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const bankData = await bankRes.json();
    const validBankIds = new Set();
    const validBankNames = new Set(); // For fallback matching

    if (bankData.success && bankData.data) {
        bankData.data.forEach(b => {
            const name = (b.bankName || '').toLowerCase();
            // user request: "just dont add easypaisa"
            if (!name.includes('easypaisa')) {
                validBankIds.add(b._id);
                validBankNames.add(name);
            }
        });
    }

    console.log(`[Calc] Valid Banks Count (Non-Easypaisa): ${validBankIds.size}`);

    // FETCH 1: Daily Cash (Verified Only + Valid Banks)
    const dcUrl = `/api/v1/daily-cash?startDate=${startDate}&endDate=${endIso}&mode=Bank&hasBank=true&branch=${encodeURIComponent(branch)}&limit=0&_t=${Date.now()}`;
    const dcRes = await fetch(dcUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const dcData = await dcRes.json();
    let dcTotal = 0;
    if (dcData.success) {
        dcTotal = dcData.data
            .filter(item => item.isVerified === true)
            .filter(item => validBankIds.has(item.bank) || validBankIds.has(item.bank?._id))
            .reduce((sum, item) => {
                let amount = parseFloat(item.totalAmount) || 0;

                // Deduction Logic: Match Bank Ledger
                // Verified entries usually have deductions applied in Ledger view, so we must mirror that here.
                const deductionRate = parseFloat(item.deductedAmount) || 0;
                // Robust check: check bool flag OR if rate > 0
                const isDed = (item.isDeduction === true || item.isDeduction === 'true');

                if (isDed || deductionRate > 0) {
                    const deductionVal = (amount * deductionRate) / 100;
                    amount = Math.round(amount - deductionVal);
                }
                return sum + amount;
            }, 0);
    }

    // FETCH 2: Bank Transactions (Valid Banks Only)
    const btUrl = `/api/v1/bank-transactions?startDate=${startDate}&endDate=${endIso}&branch=${encodeURIComponent(branch)}&limit=0&_t=${Date.now()}`;
    const btRes = await fetch(btUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const btData = await btRes.json();
    let btTotal = 0;
    if (btData.success) {
        btTotal = btData.data
            .filter(item => {
                const bId = item.bank?._id || item.bank;
                const bName = (item.bankName || '').toLowerCase();
                return validBankIds.has(bId) || validBankNames.has(bName);
            })
            .reduce((sum, item) => {
                const type = (item.type || '').toLowerCase();
                const transType = (item.transactionType || '').toLowerCase();
                const isDeposit = type === 'deposit' || type === 'received' || transType === 'deposit' || transType === 'received';
                return isDeposit ? sum + (item.amount || 0) : sum - (item.amount || 0);
            }, 0);
    }

    // FETCH 3: Bank Transfers (Smart Filter - Valid Banks Only)
    const trUrl = `/api/v1/bank-transfers?startDate=${startDate}&endDate=${endIso}&limit=0&_t=${Date.now()}`;
    const trRes = await fetch(trUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const trData = await trRes.json();
    let trTotal = 0;

    if (trData.success) {
        trData.data.forEach(t => {
            const fromId = t.fromBank?._id || t.fromBank;
            const toId = t.toBank?._id || t.toBank;

            // Incoming to a Valid Branch Bank
            if (validBankIds.has(toId)) {
                trTotal += (t.amount || 0);
            }
            // Outgoing from a Valid Branch Bank
            if (validBankIds.has(fromId)) {
                trTotal -= (t.amount || 0);
            }
        });
    }
    // Ensure we have current branch bank IDs populated
    if (currentBranchBanks.size === 0) {
        // Redundant safely covered above
    }

    const grandTotal = dcTotal + btTotal + trTotal;

    // UI Updates
    document.getElementById('new-bank-amount').value = grandTotal.toFixed(2);

    // Breakdown Updates
    document.getElementById('val-dc').textContent = dcTotal.toLocaleString();
    document.getElementById('val-bt').textContent = btTotal.toLocaleString();
    document.getElementById('val-tr').textContent = trTotal.toLocaleString();
    document.getElementById('val-total').textContent = grandTotal.toLocaleString();
}

async function calculatePendingChq(branch, dateStr) {
    const token = localStorage.getItem('token');
    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);

    // Fetch Withdrawal Transactions (Potential Cheques)
    const url = `/api/v1/bank-transactions?endDate=${endDate.toISOString()}&branch=${branch}&type=withdrawal&excludeRefType=bank_transfer&limit=0&_t=${Date.now()}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();

    let pendingTotal = 0;

    if (data.success) {
        pendingTotal = data.data
            .filter(t => !t.isVerified) // Only Unverified
            .filter(t => {
                // Double check it's not a transfer description if excludeRefType failed
                const desc = (t.narration || t.remarks || '').toLowerCase();
                const isTransfer = desc.includes('bank transfer') || desc.startsWith('transfer');

                // Exclude Easypaisa if User Requested (Old Logic) - User said "not easypaisa" in complaint, 
                // but for Pending Cheque Amount? Often usually Cheques are NOT Easypaisa.
                // We will keep it standard: Include all unverified withdrawals unless explicitly a transfer.

                return !isTransfer;
            })
            .reduce((sum, t) => sum + (t.amount || 0), 0);
    }

    document.getElementById('new-pending-chq').value = pendingTotal.toFixed(2);
}

// Add global exposure for debugging
window.calculateProDiff = calculateProDiff;
window.toggleBreakdown = toggleBreakdown;
window.initProPendingCheque = initProPendingCheque;
window.loadProBranches = loadProBranches;

// --- History / Save Logic ---

// Global variable to track editing
let editingRecordId = null;

function saveProPendingChqRecord() {
    const branch = document.getElementById('new-branch').value;
    const bankDate = document.getElementById('new-bank-date').value;
    const stmtDate = document.getElementById('new-stmt-date').value;

    if (!branch || !bankDate) {
        alert("Please select a branch and date.");
        return;
    }

    const currentDiff = document.getElementById('new-diff').value;

    const record = {
        id: editingRecordId || Date.now(),
        date: editingRecordId ? getDataById(editingRecordId).date : new Date().toISOString(), // Keep original sys date if edit
        branch: branch,
        bankDate: bankDate,
        statementDate: stmtDate,
        bankAmount: document.getElementById('new-bank-amount').value,
        pendingChq: document.getElementById('new-pending-chq').value,
        statement: document.getElementById('new-statement').value,
        diff: currentDiff
    };

    let history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');

    if (editingRecordId) {
        // Update existing
        const index = history.findIndex(h => h.id === editingRecordId);
        if (index !== -1) history[index] = record;
        editingRecordId = null; // Reset
        document.getElementById('btn-save').innerHTML = '<i class="fas fa-save me-2"></i> Save Record';
    } else {
        // Add new
        history.unshift(record);
    }

    localStorage.setItem('pending_chq_history', JSON.stringify(history));

    loadProHistory();
    alert("Record Saved Successfully!");
}

function getDataById(id) {
    const history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');
    return history.find(h => h.id === id) || {};
}

function editProRecord(id) {
    const record = getDataById(id);
    if (!record) return;

    // Populate Fields
    document.getElementById('new-branch').value = record.branch;
    // We need to trigger branch change to load banks? 
    // Maybe just set values directly if we assume banks loaded? 
    // Better to just set values and let user refresh if needed.

    document.getElementById('new-bank-date').value = record.bankDate;
    document.getElementById('new-stmt-date').value = record.statementDate || '';

    document.getElementById('new-bank-amount').value = record.bankAmount;
    document.getElementById('new-pending-chq').value = record.pendingChq;
    document.getElementById('new-statement').value = record.statement;
    document.getElementById('new-diff').value = record.diff;

    // Set Edit Mode
    editingRecordId = record.id;
    document.getElementById('btn-save').innerHTML = '<i class="fas fa-edit me-2"></i> Update Record';

    // Scroll to top
    document.getElementById('pending-chq').scrollIntoView({ behavior: 'smooth' });

    // Recalculate Diff visual state just in case
    calculateProDiff();
}

function loadProHistory() {
    const history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');
    const currentBranch = document.getElementById('new-branch').value;
    let displayData = history;
    if (currentBranch) {
        displayData = history.filter(h => h.branch === currentBranch);
    }
    renderProGrid(displayData);
}

function renderProGrid(data) {
    const tbody = document.getElementById('grid-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No data available</td></tr>';
        return;
    }

    data.forEach(item => {
        // Format System Date (Local)
        const sysDate = new Date(item.date).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="small">${sysDate}</td>
            <td>${item.statementDate || '-'}</td>
            <td>${item.branch}</td>
            <td class="text-end fw-bold text-success">${item.bankAmount}</td>
            <td class="text-end text-primary">${item.pendingChq}</td>
            <td class="text-end">${item.statement}</td>
            <td class="text-end fw-bold text-danger">${item.diff}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editProRecord(${item.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProRecord(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteProRecord(id) {
    if (!confirm("Are you sure you want to delete this record?")) return;
    let history = JSON.parse(localStorage.getItem('pending_chq_history') || '[]');
    history = history.filter(h => h.id !== id);
    localStorage.setItem('pending_chq_history', JSON.stringify(history));
    loadProHistory();
};

window.calculateProDiff = calculateProDiff;
window.toggleBreakdown = toggleBreakdown;
window.initProPendingCheque = initProPendingCheque;
window.loadProBranches = loadProBranches;
window.saveProPendingChqRecord = saveProPendingChqRecord;
window.deleteProRecord = deleteProRecord;
window.editProRecord = editProRecord;
