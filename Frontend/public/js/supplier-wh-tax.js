
document.addEventListener('DOMContentLoaded', async () => {
    // Set default dates
    const d = new Date();
    const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    // const firstDay = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; // Unused
    document.getElementById('filterDate').value = today;
    // document.getElementById('filterDateFrom').value = firstDay; // Removed
    document.getElementById('entryDate').value = today;

    await loadBranches();
    await loadSuppliers();
    await loadCategories();

    // Default selection
    const branchSelect = document.getElementById('branchSelect');
    // Only auto-select if user has exactly one branch (options include placeholder)
    if (branchSelect.options.length === 2) {
        branchSelect.selectedIndex = 1;
    } else {
        // If multiple branches (e.g. Admin), default to "Select Branch" (Index 0)
        branchSelect.selectedIndex = 0;
    }

    setupCalculations();
    setupAddButton();
    setupShortcuts();
    await loadSavedData();
});

function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            document.getElementById('saveBtn').click();
        }
    });
}

// --- Data Loading ---

let branchesMap = {};
let suppliersMap = {};
let categoriesMap = {};

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('branchSelect');
            branchesMap = {};
            data.data.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store._id;
                opt.textContent = `${store.name}`;
                select.appendChild(opt);
                branchesMap[store._id] = store.name;
            });
        }
    } catch (err) { console.error(err); }
}

async function loadSuppliers() {
    try {
        const token = localStorage.getItem('token');
        // Load virtually unlimited suppliers to ensure we have everything client-side
        const res = await fetch('/api/v1/suppliers?limit=10000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            const list = data.data;
            suppliersMap = {};

            list.forEach(sup => {
                const branchId = sup.branch?._id || sup.branch;
                let branchName = sup.branch?.name || '';

                // Fallback: If we have an ID but no name, try to look it up in our branchesMap
                if (!branchName && branchId && branchesMap[branchId]) {
                    branchName = branchesMap[branchId];
                }

                suppliersMap[sup._id] = {
                    name: sup.name,
                    ntn: sup.ntn || '',
                    subCategory: sup.subCategory || '',
                    categoryName: sup.category ? sup.category.name : '',
                    whtPer: sup.whtPer || 0,
                    advTaxPer: sup.advTaxPer || 0,
                    branchId: branchId,
                    branchName: branchName
                };
            });

            setupSearch(); // Initialize logic
        }
    } catch (err) { console.error('Error loading suppliers:', err); }
}

function setupSearch() {
    const searchInput = document.getElementById('entrySupplierSearch');
    const resultsDiv = document.getElementById('supplierSearchResults');
    let currentFocus = -1;

    searchInput.addEventListener('input', function () {
        const rawVal = this.value;
        let val = rawVal.toLowerCase().trim();

        const branchSelect = document.getElementById('branchSelect');
        const selectedBranchId = branchSelect.value;
        const selectedOption = branchSelect.options[branchSelect.selectedIndex];
        const selectedBranchName = selectedOption ? selectedOption.text : '';

        currentFocus = -1;

        if (!val) {
            resultsDiv.style.display = 'none';
            return;
        }

        const tokens = val.split(/\s+/).filter(t => t.length > 0);

        // 1. Map and Filter
        const rankedMatches = Object.keys(suppliersMap)
            .map(id => {
                const s = suppliersMap[id];

                // --- Branch Filtering ---
                if (selectedBranchId && s.branchId) {
                    // Check ID match
                    const idMatch = String(s.branchId) === String(selectedBranchId);

                    // Check Name match (Robust & Case Insensitive)
                    const sName = String(s.branchName || '').trim().toLowerCase();
                    const selName = String(selectedBranchName || '').trim().toLowerCase();
                    const nameMatch = sName && selName && (sName === selName);

                    // If neither matches, this supplier is not for this branch
                    if (!idMatch && !nameMatch) return null;
                }

                // --- Text Matching ---
                const nameLower = String(s.name || '').toLowerCase().trim();
                const subLower = String(s.subCategory || '').toLowerCase().trim();
                const combinedText = nameLower + ' ' + subLower;

                // Token Check: All typed words must appear in name OR subcategory
                const allTokensMatch = tokens.every(token => combinedText.includes(token));
                if (!allTokensMatch) return null;

                // --- Scoring ---
                let score = 0;
                if (nameLower.startsWith(val)) score += 2000;
                else if (nameLower.includes(val)) score += 100;
                if (subLower.includes(val)) score += 50;

                return { id, s, score, nameLower };
            })
            .filter(item => item !== null);

        // 2. Sort
        rankedMatches.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.nameLower.localeCompare(b.nameLower);
        });

        // 3. Slice (Display Limit)
        const finalResults = rankedMatches.slice(0, 500);

        if (finalResults.length > 0) {
            resultsDiv.innerHTML = finalResults.map((item) => {
                const { id, s } = item;

                let subCatDisplay = '';
                const rawSub = String(s.subCategory || '');
                if (rawSub) {
                    const cleanSub = rawSub.trim();
                    if (cleanSub.startsWith('(') && cleanSub.endsWith(')')) {
                        subCatDisplay = cleanSub;
                    } else {
                        subCatDisplay = `(${cleanSub})`;
                    }
                }

                return `
                <div class="search-result-item" onclick="selectSupplier('${id}')">
                    <div class="fw-bold">
                        ${s.name} <span class="text-muted fw-normal small">${subCatDisplay}</span>
                    </div>
                </div>
            `;
            }).join('');

            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.style.display = 'none';
        }
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', function (e) {
        let x = resultsDiv.getElementsByClassName("search-result-item");
        if (e.key === 'ArrowDown') {
            currentFocus++;
            addActive(x);
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            addActive(x);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1) {
                if (x && x[currentFocus]) x[currentFocus].click();
            } else if (x.length > 0) {
                // Auto-select first result on Enter if no specific focus
                x[0].click();
            }
        }
    });

    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("active-result");
        x[currentFocus].style.backgroundColor = "#e9ecef";
        x[currentFocus].scrollIntoView({ block: "nearest" });
    }

    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("active-result");
            x[i].style.backgroundColor = "";
        }
    }

    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
}

window.selectSupplier = function (id) {
    const s = suppliersMap[id];
    if (!s) return;
    document.getElementById('entrySupplierSearch').value = s.name;
    document.getElementById('entrySupplier').value = id;
    document.getElementById('entryNTN').value = s.ntn;
    document.getElementById('entryCategory').value = s.categoryName || '';
    document.getElementById('entrySubCat').value = s.subCategory;
    document.getElementById('entryTaxPct').value = s.whtPer;
    document.getElementById('entryAiTaxPct').value = s.advTaxPer;

    const amtInput = document.getElementById('entryInvAmt');
    if (amtInput.value) {
        const event = new Event('input');
        amtInput.dispatchEvent(event);
    }
    document.getElementById('supplierSearchResults').style.display = 'none';
    document.getElementById('entryDate').focus();
}

async function loadCategories() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/supplier-categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('categorySelect');
            const qsSelect = document.getElementById('qsCategory');
            categoriesMap = {};
            const options = '<option value="">Select Supplier Category</option>' +
                data.data.map(cat => {
                    categoriesMap[cat._id] = cat.name;
                    return `<option value="${cat._id}">${cat.name}</option>`;
                }).join('');
            select.innerHTML = options;
            if (qsSelect) qsSelect.innerHTML = options;
        }
    } catch (err) { console.error('Error loading categories:', err); }
}

function setupCalculations() {
    const amountInput = document.getElementById('entryInvAmt');
    const taxPctInput = document.getElementById('entryTaxPct');
    const taxDedInput = document.getElementById('entryTaxDed');
    const aiPctInput = document.getElementById('entryAiTaxPct');
    const aiAmtInput = document.getElementById('entryAiTaxAmt');

    function calculate() {
        const amt = parseFloat(amountInput.value) || 0;
        const taxPct = parseFloat(taxPctInput.value) || 0;
        const taxVal = amt * (taxPct / 100);
        taxDedInput.value = taxVal > 0 ? taxVal.toFixed(2) : '';
        const aiPct = parseFloat(aiPctInput.value) || 0;
        const aiVal = amt * (aiPct / 100);
        aiAmtInput.value = aiVal > 0 ? aiVal.toFixed(2) : '';
    }

    [amountInput, taxPctInput, aiPctInput].forEach(inp => {
        inp.addEventListener('input', calculate);
    });
}

let addedRows = [];
let editingTopRowId = null;

function setupAddButton() {
    document.getElementById('addItemBtn').addEventListener('click', () => {
        const supplierId = document.getElementById('entrySupplier').value;
        const ntn = document.getElementById('entryNTN').value;
        const date = document.getElementById('entryDate').value;
        const invNum = document.getElementById('entryInvNum').value;
        const invAmt = parseFloat(document.getElementById('entryInvAmt').value) || 0;
        const taxPct = parseFloat(document.getElementById('entryTaxPct').value) || 0;
        const taxDed = parseFloat(document.getElementById('entryTaxDed').value) || 0;
        const aiPct = parseFloat(document.getElementById('entryAiTaxPct').value) || 0;
        const aiAmt = parseFloat(document.getElementById('entryAiTaxAmt').value) || 0;

        if (!supplierId || !date || !invNum || invAmt <= 0) {
            alert('Please fill required fields (Supplier, Date, Invoice #, Amount)');
            return;
        }

        const subCat = document.getElementById('entrySubCat').value;
        const category = document.getElementById('entryCategory').value;
        const supplierName = suppliersMap[supplierId]?.name || 'Unknown';
        const rowData = {
            id: Date.now(),
            supplierId, supplierName, category, subCat, ntn, date, invNum, invAmt, taxPct, taxDed, aiPct, aiAmt
        };

        if (editingTopRowId) {
            const idx = addedRows.findIndex(r => String(r.id) === String(editingTopRowId));
            if (idx !== -1) {
                addedRows[idx] = { ...rowData, id: editingTopRowId };
            }
            editingTopRowId = null;
            document.getElementById('addItemBtn').innerHTML = '<i class="fas fa-plus"></i> Add';
            document.getElementById('addItemBtn').classList.remove('btn-warning');
            document.getElementById('addItemBtn').classList.add('btn-primary');
        } else {
            addedRows.push(rowData);
        }

        renderTableRows();
        clearEntryInputs();
    });

    ['entryInvAmt', 'entryAiTaxAmt'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('addItemBtn').click();
            }
        });
    });
}

function clearEntryInputs() {
    document.getElementById('entrySupplierSearch').value = '';
    document.getElementById('entrySupplier').value = '';
    document.getElementById('entryCategory').value = '';
    document.getElementById('entrySubCat').value = '';
    document.getElementById('entryNTN').value = '';
    document.getElementById('entryInvNum').value = '';
    document.getElementById('entryInvAmt').value = '';
    document.getElementById('entryTaxPct').value = '';
    document.getElementById('entryTaxDed').value = '';
    document.getElementById('entryAiTaxPct').value = '';
    document.getElementById('entryAiTaxAmt').value = '';
    document.getElementById('entrySupplierSearch').focus();
}

function renderTableRows() {
    const tbody = document.querySelector('#taxTable tbody');
    const rows = Array.from(tbody.children);
    for (let i = 1; i < rows.length; i++) {
        rows[i].remove();
    }

    let totalAmt = 0;
    let totalTax = 0;
    let totalAi = 0;

    addedRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.supplierName}</td>
            <td>${row.category || '-'}</td>
            <td>${row.subCat}</td>
            <td>${row.ntn}</td>
            <td>${row.date}</td>
            <td>${row.invNum}</td>
            <td class="text-end">${row.invAmt.toFixed(2)}</td>
            <td>${row.taxPct}%</td>
            <td class="text-end">${row.taxDed.toFixed(2)}</td>
            <td>${row.aiPct}%</td>
            <td class="text-end">${row.aiAmt.toFixed(2)}</td>
            <td>
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn btn-sm btn-outline-primary px-2 py-0" title="Edit row" onclick="editTopRow('${row.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger px-2 py-0" title="Remove row" onclick="removeRow('${row.id}')"><i class="fas fa-times"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        totalAmt += row.invAmt;
        totalTax += row.taxDed;
        totalAi += row.aiAmt;
    });

    document.getElementById('totalInvAmt').textContent = totalAmt.toFixed(2);
    document.getElementById('totalTaxDed').textContent = totalTax.toFixed(2);
    document.getElementById('totalAiTaxAmt').textContent = totalAi.toFixed(2);
}

window.removeRow = function (id) {
    addedRows = addedRows.filter(r => String(r.id) !== String(id));
    if (String(editingTopRowId) === String(id)) {
        editingTopRowId = null;
        document.getElementById('addItemBtn').innerHTML = '<i class="fas fa-plus"></i> Add';
        document.getElementById('addItemBtn').classList.remove('btn-warning');
        document.getElementById('addItemBtn').classList.add('btn-primary');
        clearEntryInputs();
    }
    renderTableRows();
}

window.editTopRow = function (id) {
    const row = addedRows.find(r => String(r.id) === String(id));
    if (!row) return;
    editingTopRowId = id;

    // Populate fields
    document.getElementById('entrySupplierSearch').value = row.supplierName;
    document.getElementById('entrySupplier').value = row.supplierId;
    document.getElementById('entryNTN').value = row.ntn;
    document.getElementById('entryCategory').value = row.category || '';
    document.getElementById('entrySubCat').value = row.subCat;
    document.getElementById('entryDate').value = row.date;
    document.getElementById('entryInvNum').value = row.invNum;
    document.getElementById('entryInvAmt').value = row.invAmt;
    document.getElementById('entryTaxPct').value = row.taxPct;
    document.getElementById('entryTaxDed').value = row.taxDed;
    document.getElementById('entryAiTaxPct').value = row.aiPct;
    document.getElementById('entryAiTaxAmt').value = row.aiAmt;

    // Change Add button to Update
    const btn = document.getElementById('addItemBtn');
    btn.innerHTML = '<i class="fas fa-check"></i> Update Row';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-warning');

    document.getElementById('entryInvAmt').focus();
}

// --- Save & List Logic ---
let currentEditId = null;
let loadedRecords = [];

document.getElementById('saveBtn').addEventListener('click', saveData);
document.getElementById('listBtn').addEventListener('click', () => {
    document.getElementById('savedRecordsTable').scrollIntoView({ behavior: 'smooth' });
    loadSavedData();
});

document.getElementById('searchFilterBtn').addEventListener('click', loadSavedData);
document.getElementById('filterDate').addEventListener('change', loadSavedData);
document.getElementById('categorySelect').addEventListener('change', loadSavedData);
document.getElementById('branchSelect').addEventListener('change', loadSavedData);

document.getElementById('listSearch').addEventListener('input', function (e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#savedRecordsBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

async function saveData() {
    if (addedRows.length === 0) {
        alert('No entries to save');
        return;
    }
    const branch = document.getElementById('branchSelect').value;
    const date = document.getElementById('filterDate').value;
    if (!branch || !date) {
        alert('Please select Branch and Date');
        return;
    }
    const totalAmt = addedRows.reduce((acc, r) => acc + r.invAmt, 0);
    const totalTax = addedRows.reduce((acc, r) => acc + r.taxDed, 0);
    const totalAi = addedRows.reduce((acc, r) => acc + r.aiAmt, 0);

    const payload = {
        branch,
        date,
        entries: addedRows.map(r => ({
            supplier: r.supplierId,
            supplierName: r.supplierName,
            subCategory: r.subCat,
            ntn: r.ntn,
            invoiceDate: r.date,
            invoiceNumber: r.invNum,
            invoiceAmount: r.invAmt,
            taxPct: r.taxPct,
            taxDeducted: r.taxDed,
            aiTaxPct: r.aiPct,
            aiTaxAmount: r.aiAmt
        })),
        totalAmount: totalAmt,
        totalTaxDeducted: totalTax,
        totalAiTaxAmount: totalAi
    };

    try {
        const token = localStorage.getItem('token');
        const method = currentEditId ? 'PUT' : 'POST';
        const url = currentEditId ? `/api/v1/supplier-taxes/${currentEditId}` : '/api/v1/supplier-taxes';

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert(currentEditId ? 'Data Updated Successfully!' : 'Data Saved Successfully!');
            addedRows = [];
            currentEditId = null;
            renderTableRows();
            const btn = document.getElementById('saveBtn');
            btn.innerHTML = '<i class="fas fa-save"></i> Save';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-success');
            loadSavedData();
        } else {
            alert('Error: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Network Error: ' + err.message);
        console.error(err);
    }
}

async function loadSavedData() {
    const branch = document.getElementById('branchSelect').value;
    const date = document.getElementById('filterDate').value;

    let url = '/api/v1/supplier-taxes?limit=1000';
    if (branch) url += `&branch=${branch}`;
    if (date) url += `&date=${date}`;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) {
            loadedRecords = data.data;
            renderSavedTable(data.data);
            const sumCont = document.getElementById('summaryContainer');
            if (sumCont) sumCont.style.display = 'none';
        }
    } catch (err) { console.error(err); }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}

function renderSavedTable(records) {
    const tbody = document.getElementById('savedRecordsBody');
    if (!tbody) return;
    const filterCatId = document.getElementById('categorySelect').value;
    tbody.innerHTML = '';
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted">No records found</td></tr>';
        return;
    }
    let flatRows = [];
    records.forEach(rec => {
        const sheetDate = formatDate(rec.date);
        const branchName = rec.branch ? (rec.branch.name || 'Unknown') : 'Unknown';
        if (rec.entries && rec.entries.length > 0) {
            rec.entries.forEach(entry => {
                let catName = '-';
                let entryCatId = null;

                // Obtain category and cat ID
                if (entry.supplier) {
                    let c = entry.supplier.category;
                    if (c && typeof c === 'object') {
                        catName = c.name || '-';
                        entryCatId = c._id;
                    } else if (c) {
                        catName = categoriesMap[c] || '-';
                        entryCatId = c;
                    }
                }

                // Filter by category if selected
                if (filterCatId && String(entryCatId) !== String(filterCatId)) {
                    return;
                }

                flatRows.push({
                    parentId: rec._id,
                    sheetDate,
                    branchName,
                    categoryName: catName,
                    ...entry
                });
            });
        }
    });

    flatRows.forEach(row => {
        const invDate = formatDate(row.invoiceDate);
        const tr = document.createElement('tr');
        tr.className = 'align-middle';
        tr.innerHTML = `
            <td>${row.sheetDate}</td>
            <td>${row.branchName}</td>
            <td class="fw-bold">${row.supplierName || '-'}</td>
            <td>${row.subCategory || '-'}</td>
            <td>${row.categoryName || '-'}</td>
            <td>${row.ntn || '-'}</td>
            <td>${row.invoiceNumber || '-'}</td>
            <td>${invDate}</td>
            <td class="text-end">${(row.invoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end">${row.taxPct || 0}%</td>
            <td class="text-end fw-bold text-danger">${(row.taxDeducted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end">${row.aiTaxPct || 0}%</td>
            <td class="text-end fw-bold text-success">${(row.aiTaxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>
                <div class="d-flex justify-content-center gap-1">
                    <button class="btn btn-sm btn-outline-primary px-2" title="Edit Sheet" onclick="editRecord('${row.parentId}')"><i class="fas fa-pen-to-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger px-2" title="Delete Row" onclick="deleteEntry('${row.parentId}', '${row._id}')"><i class="fas fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderGrandSummary(records) {
    const summaryBody = document.getElementById('summaryBody');
    const summaryFoot = document.getElementById('summaryFoot');
    const container = document.getElementById('summaryContainer');
    const filterCatId = document.getElementById('categorySelect').value;

    if (!records || records.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Initialize Aggregation
    let summary = {};
    let grandAmt = 0;
    let grandTax = 0;
    let grandAi = 0;

    records.forEach(rec => {
        if (rec.entries && rec.entries.length > 0) {
            rec.entries.forEach(entry => {
                let catName = 'Uncategorized';
                let entryCatId = null;

                if (entry.supplier) {
                    let c = entry.supplier.category;
                    if (c && typeof c === 'object') {
                        catName = c.name || 'Uncategorized';
                        entryCatId = c._id;
                    } else if (c) {
                        catName = categoriesMap[c] || 'Uncategorized';
                        entryCatId = c;
                    }
                }

                if (filterCatId && String(entryCatId) !== String(filterCatId)) {
                    return;
                }

                if (!summary[catName]) {
                    summary[catName] = { amount: 0, tax: 0, ai: 0 };
                }

                const invAmt = entry.invoiceAmount || 0;
                const taxDed = entry.taxDeducted || 0;
                const aiAmt = entry.aiTaxAmount || 0;

                summary[catName].amount += invAmt;
                summary[catName].tax += taxDed;
                summary[catName].ai += aiAmt;

                grandAmt += invAmt;
                grandTax += taxDed;
                grandAi += aiAmt;
            });
        }
    });

    // Render Rows
    let rowsHtml = '';
    const sortedCats = Object.keys(summary).sort();

    if (sortedCats.length === 0) {
        container.style.display = 'none';
        return;
    }

    sortedCats.forEach(cat => {
        const data = summary[cat];
        rowsHtml += `
            <tr style="border-bottom: 1px solid #000;">
                <td style="border: 1px solid #000;">${cat}</td>
                <td class="text-end" style="border: 1px solid #000;">${Math.round(data.amount).toLocaleString()}</td>
                <td class="text-end" style="border: 1px solid #000;">${Math.round(data.tax).toLocaleString()}</td>
                <td class="text-end" style="border: 1px solid #000;">${Math.round(data.ai).toLocaleString()}</td>
            </tr>
        `;
    });

    summaryBody.innerHTML = rowsHtml;

    // Render Footer
    summaryFoot.innerHTML = `
        <tr style="background-color: #cccccc; border: 1px solid #000; font-weight: bold; font-size: 1.1em;">
            <td style="border: 1px solid #000;">TOTAL</td>
            <td class="text-end" style="border: 1px solid #000;">${Math.round(grandAmt).toLocaleString()}</td>
            <td class="text-end" style="border: 1px solid #000;">${Math.round(grandTax).toLocaleString()}</td>
            <td class="text-end" style="border: 1px solid #000;">${Math.round(grandAi).toLocaleString()}</td>
        </tr>
    `;

    container.style.display = 'block';
}

window.editRecord = function (id) {
    const record = loadedRecords.find(r => r._id === id);
    if (!record) return;
    currentEditId = id;
    document.getElementById('branchSelect').value = record.branch?._id || record.branch || '';
    const recDate = record.date ? new Date(record.date).toISOString().split('T')[0] : '';
    document.getElementById('filterDate').value = recDate;
    // document.getElementById('filterDateFrom').value = recDate;
    addedRows = record.entries.map(e => ({
        id: e._id || Date.now() + Math.random(),
        supplierId: e.supplier?._id || e.supplier,
        supplierName: e.supplierName,
        subCat: e.subCategory,
        ntn: e.ntn,
        date: e.invoiceDate ? new Date(e.invoiceDate).toISOString().split('T')[0] : '',
        invNum: e.invoiceNumber,
        invAmt: e.invoiceAmount,
        taxPct: e.taxPct,
        taxDed: e.taxDeducted,
        aiPct: e.aiTaxPct,
        aiAmt: e.aiTaxAmount
    }));

    renderTableRows();
    if (addedRows.length > 0) {
        const first = addedRows[0];
        document.getElementById('entrySupplierSearch').value = first.supplierName;
        document.getElementById('entrySupplier').value = first.supplierId;
        document.getElementById('entryNTN').value = first.ntn;
        document.getElementById('entrySubCat').value = first.subCat;
        document.getElementById('entryTaxPct').value = first.taxPct;
        document.getElementById('entryAiTaxPct').value = first.aiPct;
    }
    const btn = document.getElementById('saveBtn');
    btn.innerHTML = '<i class="fas fa-edit"></i> Update';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-warning');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.deleteRecord = async function (id) {
    if (!confirm('CAUTION: Are you sure you want to delete this ENTIRE SHEET? (All entries on this sheet will be deleted)')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/supplier-taxes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            alert('Entire sheet deleted successfully');
            loadSavedData();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { alert(e); }
}

window.deleteEntry = async function (parentId, entryId) {
    if (!confirm('Are you sure you want to delete only this single entry/row?')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/supplier-taxes/${parentId}/entries/${entryId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            alert('Entry deleted successfully');
            loadSavedData();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { alert(e); }
}

window.openQuickSupplierModal = function () {
    document.getElementById('quickSupplierForm').reset();
    new bootstrap.Modal(document.getElementById('quickSupplierModal')).show();
}

window.saveQuickSupplier = async function () {
    const formData = {
        name: document.getElementById('qsName').value,
        category: document.getElementById('qsCategory').value,
        ntn: document.getElementById('qsNTN').value,
        subCategory: document.getElementById('qsSubCat').value,
        whtPer: parseFloat(document.getElementById('qsWht').value) || 0,
        advTaxPer: parseFloat(document.getElementById('qsAdv').value) || 0,
        isActive: true,
        branch: document.getElementById('branchSelect').value
    };

    if (!formData.name || !formData.category) {
        alert('Please fill Supplier Name and Category');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/suppliers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await res.json();
        if (data.success) {
            alert('Supplier Added Successfully!');
            bootstrap.Modal.getInstance(document.getElementById('quickSupplierModal')).hide();
            await loadSuppliers();
            const newSupId = data.data._id;
            suppliersMap[newSupId] = {
                name: formData.name,
                ntn: formData.ntn,
                subCategory: formData.subCategory,
                whtPer: formData.whtPer,
                advTaxPer: formData.advTaxPer
            };
            selectSupplier(newSupId);
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Error saving quick supplier:', err);
    }
}
