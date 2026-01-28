
// Employee Commission Management

let state = {
    currentTab: 'dep_item_wise',
    monthYear: new Date().toISOString().slice(0, 7),
    branch: '',
    department: '', // Initialized from selector
    subBranch: '',
    data: [], // Current table data
    masterData: [], // Items or Employees
    items: [],
    employees: [],
    currentViewData: [], // data currently being rendered (filtered)
    editingId: null, // ID of the record being edited from the list
    lockedEmployees: [] // List of employee IDs with active payrolls
};

document.addEventListener('DOMContentLoaded', async function () {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    await setupGlobalFilters();
    await loadBranches();
    await loadCategories();
    await loadMasterData();

    // NUCLEAR RESET: Force everything to empty string
    const resetSelectors = () => {
        ['mainBranch', 'whItemCategory', 'commissionItemCategory', 'globalSearch'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        state.branch = '';
        state.editingId = null;
        state.data = mergeWithMaster(state.items, [], 'item');
        state.currentTab = 'dep_item_wise';
        renderTable();
    };

    // Multiple sweeps to catch browser auto-fill/restoration
    resetSelectors();
    setTimeout(resetSelectors, 100);
    setTimeout(resetSelectors, 500);
    setTimeout(resetSelectors, 1000);

    // Keyboard Shortcuts
    document.addEventListener('keydown', function (e) {
        // Alt + S to Save
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveCurrentTab();
        }

        // Modal Shortcuts (only if modal is visible)
        const modal = document.getElementById('commissionListModal');
        if (modal && modal.classList.contains('show')) {
            // Ctrl to focus Search
            if (e.key === 'Control') {
                e.preventDefault();
                document.getElementById('modalListSearch')?.focus();
            }
            // Alt + B to focus Search as well (per user requirement)
            if (e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                document.getElementById('modalListSearch')?.focus();
            }
        }
    });
});

async function setupGlobalFilters(isReset = false) {
    const today = new Date();
    document.getElementById('mainMonthYear').value = today.toISOString().slice(0, 7);

    // Set default user
    if (localStorage.getItem('user')) {
        const user = JSON.parse(localStorage.getItem('user'));
        document.getElementById('userName').textContent = user.name || 'User';
    }
}

async function loadCategories(isReset = false) {
    try {
        const token = localStorage.getItem('token');

        // Load WH Item Categories
        const resWh = await fetch('/api/v1/wh-item-categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resWh.ok) {
            const json = await resWh.json();
            const categories = json.data || [];
            const sel = document.getElementById('whItemCategory');
            if (sel) {
                sel.innerHTML = '<option value="">Select WH Category</option>';
                categories.forEach(c => {
                    sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
                });
                if (isReset) sel.value = "";
            }
        }

        // Load Commission Item Categories
        const resComm = await fetch('/api/v1/commission-categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resComm.ok) {
            const json = await resComm.json();
            const categories = json.data || [];
            const sel = document.getElementById('commissionItemCategory');
            if (sel) {
                sel.innerHTML = '<option value="">Select Comm. Category</option>';
                categories.forEach(c => {
                    sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
                });
                if (isReset) sel.value = "";
            }
        }

        // Load Employee Departments for Global Filter
        const resDept = await fetch('/api/v1/employee-departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resDept.ok) {
            const json = await resDept.json();
            const depts = json.data || [];
            const sel = document.getElementById('globalDepartment');
            if (sel) {
                sel.innerHTML = '<option value="">All Departments</option>';
                depts.forEach(d => {
                    sel.innerHTML += `<option value="${d.name}">${d.name}</option>`;
                });
                if (isReset) sel.value = "";
            }
        }
    } catch (e) {
        console.error('Error loading categories:', e);
    }
}

// Auto-update when branch changes
document.getElementById('mainBranch')?.addEventListener('change', () => {
    loadCurrentTab();
});

async function loadBranches(isReset = false) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let branches = [];
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                branches = json.data.filter(s => s.isActive).map(s => s.name);
            }
        }

        const selects = ['mainBranch', 'empSubBranch', 'distSubBranch', 'rottiSubBranch', 'perksSubBranch'];

        selects.forEach(id => {
            const sel = document.getElementById(id);
            if (sel) {
                sel.innerHTML = '<option value="">Select Branch</option>';
                branches.forEach(b => {
                    sel.innerHTML += `<option value="${b}">${b}</option>`;
                });
                if (isReset) sel.value = "";
            }
        });

    } catch (error) {
        console.error('Error loading branches:', error);
    }
}

async function loadMasterData() {
    try {
        const token = localStorage.getItem('token');

        // Load Commission Items
        const resComm = await fetch('/api/v1/commission-items?limit=2000', { headers: { 'Authorization': `Bearer ${token}` } });
        let commItems = [];
        if (resComm.ok) {
            const json = await resComm.json();
            commItems = (json.data || []).map(i => ({ ...i, itemType: 'commission' }));
        }

        // Load WH Items
        const resWh = await fetch('/api/v1/wh-items?limit=2000', { headers: { 'Authorization': `Bearer ${token}` } });
        let whItems = [];
        if (resWh.ok) {
            const json = await resWh.json();
            whItems = (json.data || []).map(i => ({ ...i, itemType: 'wh' }));
        }

        state.items = [...commItems, ...whItems];

        // Load Employees
        const resEmp = await fetch('/api/v1/employees?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resEmp.ok) {
            const json = await resEmp.json();
            state.employees = json.data || [];
        } else {
            const resParties = await fetch('/api/v1/parties?partyType=employee&limit=1000', { headers: { 'Authorization': `Bearer ${token}` } });
            if (resParties.ok) {
                const json = await resParties.json();
                state.employees = json.data || [];
            }
        }

    } catch (e) {
        console.error("Failed to load master data", e);
    }
}

function setTab(tabName) {
    state.currentTab = tabName;
    loadCurrentTab();
}

async function loadCurrentTab(forceLoad = false) {
    state.monthYear = document.getElementById('mainMonthYear').value;
    state.branch = document.getElementById('mainBranch').value;
    state.department = document.getElementById('globalDepartment').value;

    if (!state.branch) {
        // No branch selected? Show zeros (master data)
        state.data = mergeWithMaster(
            state.currentTab === 'dep_item_wise' ? state.items : state.employees,
            [],
            state.currentTab === 'dep_item_wise' ? 'item' : 'employee'
        );
        if (state.currentTab === 'dep_item_wise') applyLocalFilter();
        else renderTable();
        return;
    }

    let subBranchId = '';
    if (state.currentTab === 'employee_wise') subBranchId = 'empSubBranch';
    else if (state.currentTab === 'distribute') subBranchId = 'distSubBranch';
    else if (state.currentTab === 'rotti_nashta') subBranchId = 'rottiSubBranch';
    else if (state.currentTab === 'rotti_perks') subBranchId = 'perksSubBranch';

    state.subBranch = subBranchId ? (document.getElementById(subBranchId)?.value || '') : '';

    // Get categories if on item wise tab
    let whCat = "";
    let commCat = "";
    if (state.currentTab === 'dep_item_wise') {
        whCat = document.getElementById('whItemCategory').value;
        commCat = document.getElementById('commissionItemCategory').value;
    }

    // STRICTOR ENTRY MODE: For Item-Wise, we NEVER auto-load saved data. 
    // EXCEPT when we are explicitly editing a record from the List (forceLoad).
    if (state.currentTab === 'dep_item_wise' && !forceLoad && !state.editingId) {
        state.data = mergeWithMaster(state.items, [], 'item');
        applyLocalFilter(); // Respect selected categories
        hideLoading();
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const query = new URLSearchParams({
            monthYear: state.monthYear,
            branch: state.branch,
            department: state.department,
            subBranch: state.subBranch,
            type: state.currentTab
        });

        if (state.currentTab === 'dep_item_wise') {
            query.append('whCategory', whCat);
            query.append('commissionCategory', commCat);
        }

        const res = await fetch(`/api/v1/employee-commissions?${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Fetch payroll status separately
        state.lockedEmployees = [];
        try {
            const pRes = await fetch(`/api/v1/payrolls?monthYear=${state.monthYear}&branch=${state.branch}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const pJson = await pRes.json();
            if (pJson.success) {
                // Collect IDs of employees who already have a payroll
                state.lockedEmployees = pJson.data.map(p => (p.employee?._id || p.employee || '').toString());
            }
        } catch (pe) { console.error('Payroll check failed:', pe); }

        const json = await res.json();
        let savedData = json.data ? (json.data.data || []) : [];

        if (state.currentTab === 'dep_item_wise') {
            state.data = mergeWithMaster(state.items, savedData, 'item');
            // Only purely local filtering now (text search)
            applyLocalFilter();
        } else {
            state.data = mergeWithMaster(state.employees, savedData, 'employee');
            renderTable();
        }

    } catch (e) {
        console.error(e);
        alert('Error loading data');
        renderTable();
    } finally {
        hideLoading();
    }
}

function filterItemWiseTable() {
    // Apply local filtering to show only items from selected category (all with zero qty)
    applyLocalFilter();
}

function applyLocalFilter() {
    if (state.currentTab !== 'dep_item_wise') return;

    const whCat = document.getElementById('whItemCategory').value;
    const commCat = document.getElementById('commissionItemCategory').value;
    const search = (document.getElementById('itemSearch')?.value || '').toLowerCase();

    let filtered = [];

    // Category filtering (already handled by loadCurrentTab fetching saved data, 
    // but we still need to filter the MASTER items displayed in the list if they weren't saved)

    if (!whCat && !commCat) {
        filtered = state.data;
    } else {
        if (whCat) {
            const whMatches = state.data.filter(i => i.originType === 'wh' && i.whCategoryName === whCat);
            filtered = [...filtered, ...whMatches];
        }
        if (commCat) {
            const commMatches = state.data.filter(i => i.originType === 'commission' && i.commissionCategoryName === commCat);
            filtered = [...filtered, ...commMatches];
        }
    }

    // Apply Text Search Filter
    if (search) {
        filtered = filtered.filter(item =>
            item.name.toLowerCase().includes(search) ||
            item.code.toLowerCase().includes(search)
        );
    }

    renderTable(filtered);
}

function applyGlobalSearch() {
    const search = (document.getElementById('globalSearch')?.value || '').toLowerCase();
    if (!search) {
        renderTable(state.data);
        return;
    }

    const filtered = state.data.filter(item =>
        (item.name && item.name.toLowerCase().includes(search)) ||
        (item.code && item.code.toLowerCase().includes(search))
    );

    renderTable(filtered);
}

function clearItemFilters() {
    document.getElementById('whItemCategory').value = "";
    document.getElementById('commissionItemCategory').value = "";
    document.getElementById('itemSearch').value = "";
    loadCurrentTab(); // Fetch all items for current branch/month/dept
}

function mergeWithMaster(masterList, savedList, type) {
    if (type === 'item') {
        return masterList.map(m => {
            const mId = m._id?.toString() || m.id?.toString();
            const saved = savedList.find(s => s.id === mId);
            const catName = (m.category && m.category.name) ? m.category.name : '';

            return {
                id: mId,
                name: m.name,
                code: m.code || m.itemsCode || '',
                originType: m.itemType, // 'wh' or 'commission'
                whCategoryName: (m.itemType === 'wh') ? catName : '',
                commissionCategoryName: (m.itemType === 'commission') ? catName : '',
                incentive: (saved && saved.incentive !== undefined) ? saved.incentive : (m.incentive || 0),
                qty: saved ? saved.qty : 0,
                total: saved ? saved.total : 0,
            };
        });
    }

    return masterList.map(m => {
        const mId = m._id?.toString() || m.id?.toString();
        const saved = savedList.find(s => s.id === mId);

        // Sanitize Department and Branch - Extract name if it's an object
        const dept = (m.department && typeof m.department === 'object') ? m.department.name : m.department;
        const br = (m.branch && typeof m.branch === 'object') ? m.branch.name : m.branch;

        return {
            id: mId,
            name: m.name,
            code: m.code || '',
            department: dept || '',
            branch: br || '',
            commission: saved ? saved.commission : 0,
            otherCommission: saved ? saved.otherCommission : 0,
            ugCommission: saved ? saved.ugCommission : 0,
            warehouseCommission: saved ? saved.warehouseCommission : 0,
            nashtaDays: saved ? saved.nashtaDays : 0,
            nashtaRate: saved ? saved.nashtaRate : 0,
            nashtaTotal: saved ? saved.nashtaTotal : 0,
            rottiDays: saved ? saved.rottiDays : 0,
            rottiRate: saved ? saved.rottiRate : 0,
            rottiTotal: saved ? saved.rottiTotal : 0,
            basicSalary: saved ? saved.basicSalary : (m.basicSalary || 0),
            workedDays: saved ? saved.workedDays : 0,
            rottiTimes: saved ? saved.rottiTimes : 0,
            totalData: saved ? saved.totalData : 0
        };
    });
}
function renderTable(dataToRender = null) {
    const tab = state.currentTab;
    let tbodyId = '';
    let html = '';
    let data = dataToRender || state.data;

    // Apply Department Filter from Global Header for Employee Tabs ONLY
    const selDept = document.getElementById('globalDepartment')?.value || '';
    if (tab !== 'dep_item_wise' && selDept) {
        data = data.filter(e => e.department === selDept);
    }

    // Apply Main Branch Filter from Global Header for Employee Tabs
    const headerBranch = document.getElementById('mainBranch')?.value || state.branch;
    if (tab !== 'dep_item_wise' && headerBranch) {
        data = data.filter(e => {
            const empBranch = (e.branch || '').toString().trim();
            const targetBranch = headerBranch.toString().trim();
            return empBranch === targetBranch;
        });
    }

    state.currentViewData = data;

    if (tab === 'dep_item_wise') {
        tbodyId = 'itemWiseBody';
        html = data.map((item, i) => `
            <tr data-id="${item.id}">
                <td>${item.code}</td>
                <td class="text-start ps-3">${item.name}</td>
                <td><input type="number" class="form-control form-control-sm text-center bg-light" value="${item.incentive || 0}" readonly></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${item.qty}" oninput="updateRow('${item.id}', 'qty', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${item.total || 0}" readonly></td>
            </tr>
        `).join('');
    }
    else if (tab === 'employee_wise') {
        tbodyId = 'empWiseBody';
        let total = 0;
        html = data.map((emp, i) => {
            const isLocked = state.lockedEmployees.includes(emp.id.toString());
            total += parseFloat(emp.commission || 0);
            return `
            <tr data-id="${emp.id}" class="${isLocked ? 'row-locked' : ''}">
                <td>${emp.code}</td>
                <td>${emp.name} ${isLocked ? '<span class="locked-badge">PAID</span>' : ''}</td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.commission}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'commission', this.value)"></td>
                <td>
                    ${isLocked ? '<i class="fas fa-lock text-warning"></i>' : `<button class="btn btn-sm btn-info" onclick="saveCurrentTab()"><i class="fas fa-save"></i></button>`}
                </td>
            </tr>
        `}).join('');
        const totalEl = document.getElementById('empWiseTotal');
        if (totalEl) totalEl.textContent = total.toFixed(2);
    }
    else if (tab === 'distribute') {
        tbodyId = 'distributeBody';
        let t1 = 0, t2 = 0, t3 = 0, t4 = 0;
        html = data.map((emp, i) => {
            const isLocked = state.lockedEmployees.includes(emp.id.toString());
            const tot = (parseFloat(emp.otherCommission) || 0) + (parseFloat(emp.ugCommission) || 0) + (parseFloat(emp.warehouseCommission) || 0);
            t1 += parseFloat(emp.otherCommission) || 0;
            t2 += parseFloat(emp.ugCommission) || 0;
            t3 += parseFloat(emp.warehouseCommission) || 0;
            t4 += tot;
            return `
            <tr data-id="${emp.id}" class="${isLocked ? 'row-locked' : ''}">
                <td>${emp.code}</td>
                <td>${emp.name} ${isLocked ? '<span class="locked-badge">PAID</span>' : ''}</td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.otherCommission}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'otherCommission', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.ugCommission}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'ugCommission', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.warehouseCommission}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'warehouseCommission', this.value)"></td>
                <td class="fw-bold row-total">${tot.toFixed(2)}</td>
            </tr>
        `}).join('');
        const el1 = document.getElementById('distOtherTotal');
        const el2 = document.getElementById('distUgTotal');
        const el3 = document.getElementById('distWarehouseTotal');
        const el4 = document.getElementById('distGrandTotal');
        if (el1) el1.innerText = t1.toFixed(2);
        if (el2) el2.innerText = t2.toFixed(2);
        if (el3) el3.innerText = t3.toFixed(2);
        if (el4) el4.innerText = t4.toFixed(2);
    }
    else if (tab === 'rotti_nashta') {
        tbodyId = 'rottiNashtaBody';
        let total = 0;
        html = data.map((emp, i) => {
            const isLocked = state.lockedEmployees.includes(emp.id.toString());
            const nTotal = parseFloat(emp.nashtaTotal) || 0;
            const rTotal = parseFloat(emp.rottiTotal) || 0;
            const grand = nTotal + rTotal;
            total += grand;
            return `
            <tr data-id="${emp.id}" class="${isLocked ? 'row-locked' : ''}">
                <td>${emp.code}</td>
                <td>${emp.name} ${isLocked ? '<span class="locked-badge">PAID</span>' : ''}</td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.nashtaDays}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'nashtaDays', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.nashtaRate}" placeholder="Rate" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'nashtaRate', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center bg-light row-n-total" value="${nTotal}" readonly></td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.rottiDays}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'rottiDays', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.rottiRate}" placeholder="Rate" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'rottiRate', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center bg-light row-r-total" value="${rTotal}" readonly></td>
                <td class="fw-bold row-total">${grand.toFixed(2)}</td>
            </tr>
        `}).join('');
        const totalEl = document.getElementById('rottiNashtaTotal');
        if (totalEl) totalEl.innerText = total.toFixed(2);
    }
    else if (tab === 'rotti_perks') {
        tbodyId = 'rottiPerksBody';
        let total = 0;
        html = data.map((emp, i) => {
            const isLocked = state.lockedEmployees.includes((emp.id || '').toString());
            const tot = parseFloat(emp.totalData) || 0;
            total += tot;
            return `
            <tr data-id="${emp.id}" class="${isLocked ? 'row-locked' : ''}">
                <td>${i + 1}</td>
                <td>${emp.code}</td>
                <td>${emp.name} ${isLocked ? '<span class="locked-badge">PAID</span>' : ''}</td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.basicSalary}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'basicSalary', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.workedDays}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'workedDays', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.rottiRate}" placeholder="Rotti" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'rottiRate', this.value)"></td> 
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.rottiTimes}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'rottiTimes', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.nashtaRate}" placeholder="Nashta" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'nashtaRate', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.nashtaTotal}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'nashtaTotal', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.totalData}" ${isLocked ? 'readonly' : ''} oninput="updateRow('${emp.id}', 'totalData', this.value)"></td>
            </tr>
        `}).join('');
        const totalEl = document.getElementById('rottiPerksGrandTotal');
        if (totalEl) totalEl.innerText = total.toFixed(2);
    }

    const container = document.getElementById(tbodyId);
    if (container) container.innerHTML = html;
}

function updateRow(id, field, value) {
    if (state.lockedEmployees.includes(id.toString())) {
        console.warn('Row is locked by payroll');
        return;
    }
    const item = state.data.find(i => i.id === id);
    if (!item) return;

    item[field] = parseFloat(value) || 0;

    if (state.currentTab === 'dep_item_wise') {
        const incentive = item.incentive || 0;
        const qty = item.qty || 0;
        const total = incentive * qty;
        item.total = total;

        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const totalInput = row.querySelector('td:nth-child(5) input');
            if (totalInput) totalInput.value = total;
        }
    }
    else if (state.currentTab === 'employee_wise') {
        const total = state.data.reduce((sum, e) => sum + (parseFloat(e.commission) || 0), 0);
        const totalEl = document.getElementById('empWiseTotal');
        if (totalEl) totalEl.textContent = total.toFixed(2);
    }
    else if (state.currentTab === 'distribute') {
        const tot = (parseFloat(item.otherCommission) || 0) + (parseFloat(item.ugCommission) || 0) + (parseFloat(item.warehouseCommission) || 0);
        item.total = tot;

        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const totEl = row.querySelector('.row-total');
            if (totEl) totEl.innerText = tot.toFixed(2);
        }

        // Update Footer Totals
        let t1 = 0, t2 = 0, t3 = 0, t4 = 0;
        state.data.forEach(e => {
            t1 += parseFloat(e.otherCommission) || 0;
            t2 += parseFloat(e.ugCommission) || 0;
            t3 += parseFloat(e.warehouseCommission) || 0;
            t4 += (parseFloat(e.otherCommission) || 0) + (parseFloat(e.ugCommission) || 0) + (parseFloat(e.warehouseCommission) || 0);
        });
        const el1 = document.getElementById('distOtherTotal');
        const el2 = document.getElementById('distUgTotal');
        const el3 = document.getElementById('distWarehouseTotal');
        const el4 = document.getElementById('distGrandTotal');
        if (el1) el1.innerText = t1.toFixed(2);
        if (el2) el2.innerText = t2.toFixed(2);
        if (el3) el3.innerText = t3.toFixed(2);
        if (el4) el4.innerText = t4.toFixed(2);
    }
    else if (state.currentTab === 'rotti_nashta') {
        item.nashtaTotal = item.nashtaDays * (item.nashtaRate || 0);
        item.rottiTotal = item.rottiDays * (item.rottiRate || 0);
        const grand = item.nashtaTotal + item.rottiTotal;

        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const ntEl = row.querySelector('.row-n-total');
            const rtEl = row.querySelector('.row-r-total');
            const gtEl = row.querySelector('.row-total');
            if (ntEl) ntEl.value = item.nashtaTotal;
            if (rtEl) rtEl.value = item.rottiTotal;
            if (gtEl) gtEl.innerText = grand.toFixed(2);
        }

        const total = state.data.reduce((sum, e) => sum + (parseFloat(e.nashtaTotal) || 0) + (parseFloat(e.rottiTotal) || 0), 0);
        const totalEl = document.getElementById('rottiNashtaTotal');
        if (totalEl) totalEl.innerText = total.toFixed(2);
    }
    else if (state.currentTab === 'rotti_perks') {
        const total = state.data.reduce((sum, e) => sum + (parseFloat(e.totalData) || 0), 0);
        const totalEl = document.getElementById('rottiPerksGrandTotal');
        if (totalEl) totalEl.innerText = total.toFixed(2);
    }
}

async function saveCurrentTab() {
    const token = localStorage.getItem('token');

    // Refresh state from header inputs
    state.monthYear = document.getElementById('mainMonthYear').value;
    state.branch = document.getElementById('mainBranch').value;
    state.department = document.getElementById('globalDepartment').value;

    if (!state.branch || !state.monthYear) {
        return alert('Please select Branch and Month-Year first');
    }

    let whCat = "";
    let commCat = "";
    if (state.currentTab === 'dep_item_wise') {
        whCat = document.getElementById('whItemCategory').value;
        commCat = document.getElementById('commissionItemCategory').value;
    }

    let dataToSave = state.data;
    if (state.currentTab === 'dep_item_wise') {
        if (whCat || commCat) {
            dataToSave = state.data.filter(item => {
                if (whCat && item.originType === 'wh' && item.whCategoryName === whCat) return true;
                if (commCat && item.originType === 'commission' && item.commissionCategoryName === commCat) return true;
                return false;
            });
        }
    }

    const payload = {
        id: state.editingId,
        monthYear: state.monthYear,
        branch: state.branch,
        department: state.department,
        subBranch: state.subBranch,
        type: state.currentTab,
        whCategory: whCat,
        commissionCategory: commCat,
        fromDate: document.getElementById('perksFromDate')?.value,
        toDate: document.getElementById('perksToDate')?.value,
        data: dataToSave
    };

    showLoading();

    try {
        const res = await fetch('/api/v1/employee-commissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
            // WIPE EVERYTHING BEFORE SHOWING ALERT
            if (document.getElementById('whItemCategory')) document.getElementById('whItemCategory').value = '';
            if (document.getElementById('commissionItemCategory')) document.getElementById('commissionItemCategory').value = '';
            if (document.getElementById('mainBranch')) document.getElementById('mainBranch').value = '';

            state.branch = '';
            state.data = mergeWithMaster(state.items, [], 'item');
            renderTable();

            alert('Saved Successfully!');
            window.location.href = 'employee-commission.html?reset=' + Date.now();
        } else {
            alert('Error: ' + json.message);
        }

    } catch (e) {
        console.error(e);
        alert('Failed to save');
    } finally {
        hideLoading();
    }
}

async function showCommissionList() {
    const modal = new bootstrap.Modal(document.getElementById('commissionListModal'));
    modal.show();

    // Populate branch filter in modal
    const mainBranchSel = document.getElementById('mainBranch');
    const modalBranchSel = document.getElementById('modalBranchFilter');
    if (mainBranchSel && modalBranchSel) {
        modalBranchSel.innerHTML = '<option value="">All Branches</option>';
        Array.from(mainBranchSel.options).forEach(opt => {
            if (opt.value) {
                const newOpt = document.createElement('option');
                newOpt.value = opt.value;
                newOpt.textContent = opt.textContent;
                modalBranchSel.appendChild(newOpt);
            }
        });
        // Set default to current header branch
        modalBranchSel.value = mainBranchSel.value;
    }

    loadCommissionRecords();
}

async function loadCommissionRecords() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/employee-commissions/list', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (!json.success) return;

        state.allSavedRecords = json.data; // Store full list for local filter
        filterModalList(); // Use the filter function to respect default branch selection
    } catch (e) {
        console.error(e);
    }
}

function renderModalList(records) {
    const body = document.getElementById('commissionListBody');
    body.innerHTML = records.map(c => {
        const dataStr = encodeURIComponent(JSON.stringify(c));

        return `
            <tr>
                <td style="width: 100px;">
                    <button class="btn-select-custom mx-auto" onclick="viewCommission('${dataStr}')">
                        <i class="far fa-edit"></i> Select
                    </button>
                </td>
                <td class="cell-blue-light fw-bold">${c.monthYear}</td>
                <td class="cell-blue-medium fw-bold">${c.branch}</td>
                <td class="cell-green fw-bold text-uppercase">${c.type.replace(/_/g, ' ')}</td>
                <td class="cell-pink text-start ps-3 fw-bold">${[c.whCategory, c.commissionCategory].filter(Boolean).join(' / ') || '-'}</td>
                <td class="cell-purple fw-normal small">${new Date(c.createdAt).toLocaleString()}</td>
                <td class="cell-blue-medium">
                    <div class="d-flex gap-1 justify-content-center">
                        <button class="btn btn-warning btn-sm text-white shadow-sm" onclick="printFromList('${dataStr}')"><i class="fas fa-print"></i></button>
                        <button class="btn btn-danger btn-sm shadow-sm" onclick="deleteCommissionRecord('${c._id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterModalList() {
    const search = (document.getElementById('modalListSearch')?.value || '').toLowerCase();
    const branchFilter = document.getElementById('modalBranchFilter')?.value || "";
    const typeFilter = document.getElementById('modalTypeFilter')?.value || "";

    if (!state.allSavedRecords) return;

    const filtered = state.allSavedRecords.filter(c => {
        const matchesSearch = !search || (
            c.monthYear.toLowerCase().includes(search) ||
            c.branch.toLowerCase().includes(search) ||
            c.type.toLowerCase().includes(search) ||
            (c.whCategory && c.whCategory.toLowerCase().includes(search)) ||
            (c.commissionCategory && c.commissionCategory.toLowerCase().includes(search))
        );

        const matchesBranch = !branchFilter || c.branch === branchFilter;
        const matchesType = !typeFilter || c.type === typeFilter;

        return matchesSearch && matchesBranch && matchesType;
    });

    renderModalList(filtered);
}

async function viewCommission(dataStr) {
    const c = JSON.parse(decodeURIComponent(dataStr));

    // Set parameters
    document.getElementById('mainMonthYear').value = c.monthYear;
    document.getElementById('mainBranch').value = c.branch;
    document.getElementById('globalDepartment').value = c.department || '';

    // Switch Tab
    const tabEl = document.querySelector(`button[data-bs-target="#${c.type.replace(/_/g, '-')}"]`);
    if (tabEl) {
        const tab = new bootstrap.Tab(tabEl);
        tab.show();
        state.currentTab = c.type;
    }

    // Set editing context
    state.editingId = c._id || c.id;

    // Set Categories if applicable
    if (c.type === 'dep_item_wise') {
        document.getElementById('whItemCategory').value = c.whCategory || '';
        document.getElementById('commissionItemCategory').value = c.commissionCategory || '';
        document.getElementById('itemSearch').value = '';
    }

    // Load data forcing the database fetch
    loadCurrentTab(true);

    // Close modal
    const modalEl = document.getElementById('commissionListModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
}

async function printFromList(dataStr) {
    const c = JSON.parse(decodeURIComponent(dataStr));
    try {
        const token = localStorage.getItem('token');
        const id = c._id || c.id;
        if (!id) throw new Error('Record ID missing');

        const res = await fetch(`/api/v1/employee-commissions/detail/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({ message: 'Server error' }));
            throw new Error(errJson.message || 'Fetch failed');
        }

        const json = await res.json();
        if (json.success && json.data) {
            // SYNC HEADERS (Important for correct print report headers)
            const mainMonth = document.getElementById('mainMonthYear');
            const mainBranch = document.getElementById('mainBranch');
            const globalDept = document.getElementById('globalDepartment');

            if (mainMonth) mainMonth.value = json.data.monthYear;
            if (mainBranch) mainBranch.value = json.data.branch;
            if (globalDept) globalDept.value = json.data.department || '';

            if (json.data.type === 'dep_item_wise') {
                const whCat = document.getElementById('whItemCategory');
                const commCat = document.getElementById('commissionItemCategory');
                if (whCat) whCat.value = json.data.whCategory || '';
                if (commCat) commCat.value = json.data.commissionCategory || '';
            }

            // Set temporary view data and print
            const oldType = state.currentTab;
            const oldViewData = state.currentViewData;

            state.currentTab = json.data.type;
            state.currentViewData = json.data.data || [];

            await printCommission();

            // Restore state
            state.currentTab = oldType;
            state.currentViewData = oldViewData;
        }
    } catch (e) {
        console.error('Print from list error:', e);
        alert('Error fetching data for print: ' + e.message);
    }
}

async function deleteCommissionRecord(id) {
    if (!confirm('Are you sure you want to delete this commission record?')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/employee-commissions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
            alert('Deleted successfully');
            loadCommissionRecords();
        }
    } catch (e) {
        alert('Delete failed');
    }
}

async function printCommission() {
    let data = state.currentViewData || [];

    // Filter data to only show rows with actual values (Qty > 0 or Total > 0)
    if (state.currentTab === 'dep_item_wise') {
        data = data.filter(item => (parseFloat(item.qty) || 0) > 0);
    } else if (state.currentTab === 'employee_wise') {
        data = data.filter(item => (parseFloat(item.commission) || 0) > 0);
    } else if (state.currentTab === 'distribute') {
        data = data.filter(item => {
            const tot = (parseFloat(item.otherCommission) || 0) + (parseFloat(item.ugCommission) || 0) + (parseFloat(item.warehouseCommission) || 0);
            return tot > 0;
        });
    } else if (state.currentTab === 'rotti_nashta') {
        data = data.filter(item => {
            const tot = (parseFloat(item.nashtaTotal) || 0) + (parseFloat(item.rottiTotal) || 0);
            return tot > 0;
        });
    } else if (state.currentTab === 'rotti_perks') {
        data = data.filter(item => (parseFloat(item.totalData) || 0) > 0);
    }

    if (data.length === 0) return alert('No data to print (Rows with Qty/Total > 0 required)');

    // Get Company Info
    let company = { name: 'BAS SOFTWARE', address: '', phone: '', logo: '' };
    try {
        const token = localStorage.getItem('token');
        const resSet = await fetch('/api/v1/settings', { headers: { 'Authorization': `Bearer ${token}` } });
        const jsonSet = await resSet.json();
        if (jsonSet.success && jsonSet.data) {
            company = jsonSet.data;
        }
    } catch (e) { }

    const branch = document.getElementById('mainBranch').value || 'All Branches';
    const month = document.getElementById('mainMonthYear').value;
    const dept = document.getElementById('globalDepartment')?.value || '';
    const subBranch = state.subBranch ? ` (${state.subBranch})` : '';

    let catInfo = "";
    if (state.currentTab === 'dep_item_wise') {
        const whCat = document.getElementById('whItemCategory')?.value || '';
        const commCat = document.getElementById('commissionItemCategory')?.value || '';
        if (whCat) catInfo = `Category: ${whCat}`;
        if (commCat) catInfo = `Category: ${commCat}`;
    }

    const printWindow = window.open('', '_blank');

    let tableHtml = "";
    let headers = [];
    let rows = [];

    if (state.currentTab === 'dep_item_wise') {
        headers = ['Code', 'Product Name', 'Incentive', 'Qty', 'Total'];
        rows = data.map(item => {
            const master = state.items.find(mi => mi._id === item.id || mi.id === item.id);
            const code = item.code || master?.itemsCode || master?.barcode || master?.code || '';
            return [code, item.name || '', item.incentive || 0, item.qty || 0, item.total || 0];
        });
    } else if (state.currentTab === 'employee_wise') {
        headers = ['Code', 'Employee Name', 'Commission'];
        rows = data.map(item => {
            const master = state.employees.find(me => me._id === item.id || me.id === item.id);
            const code = item.code || master?.code || '';
            return [code, item.name || '', item.commission || 0];
        });
    } else if (state.currentTab === 'distribute') {
        headers = ['Code', 'Employee', 'Other', 'UG', 'WH', 'Total'];
        rows = data.map(item => {
            const master = state.employees.find(me => me._id === item.id || me.id === item.id);
            const code = item.code || master?.code || '';
            return [code, item.name || '', item.otherCommission || 0, item.ugCommission || 0, item.warehouseCommission || 0, (parseFloat(item.otherCommission || 0) + parseFloat(item.ugCommission || 0) + parseFloat(item.warehouseCommission || 0)).toFixed(2)];
        });
    } else if (state.currentTab === 'rotti_nashta') {
        headers = ['Code', 'Employee', 'N. Days', 'N. Rate', 'N. Total', 'R. Days', 'R. Rate', 'R. Total', 'G. Total'];
        rows = data.map(item => {
            const master = state.employees.find(me => me._id === item.id || me.id === item.id);
            const code = item.code || master?.code || '';
            return [
                code, item.name || '', item.nashtaDays || 0, item.nashtaRate || 0, item.nashtaTotal || 0,
                item.rottiDays || 0, item.rottiRate || 0, item.rottiTotal || 0,
                (parseFloat(item.nashtaTotal || 0) + parseFloat(item.rottiTotal || 0)).toFixed(2)
            ];
        });
    } else if (state.currentTab === 'rotti_perks') {
        headers = ['Sr.', 'Code', 'Employee Name', 'Basic', 'Days', 'Rotti', 'Nashta', 'Total'];
        rows = data.map((item, idx) => {
            const master = state.employees.find(me => me._id === item.id || me.id === item.id);
            const code = item.code || master?.code || '';
            return [
                idx + 1, code, item.name || '', item.basicSalary || 0, item.workedDays || 0,
                item.rottiRate || 0, item.nashtaRate || 0, item.totalData || 0
            ];
        });
    } else {
        // Fallback or generic
        headers = ['Code', 'Name', 'Total'];
        rows = data.map(item => [item.code, item.name, item.total || item.totalData || 0]);
    }

    const totalInList = rows.reduce((sum, row) => sum + (parseFloat(row[row.length - 1]) || 0), 0);

    printWindow.document.write(`
        <html>
        <head>
            <title>Commission Report - ${branch}</title>
            <style>
                @page { size: A4; margin: 10mm; }
                body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 0; font-size: 11px; line-height: 1.4; }
                
                .print-container { width: 100%; max-width: 800px; margin: 0 auto; }
                
                .header-wrapper { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a73e8; padding-bottom: 10px; margin-bottom: 20px; }
                .logo-section { display: flex; align-items: center; gap: 15px; }
                .logo-placeholder { width: 50px; height: 50px; background: #1a73e8; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 8px; font-size: 20px; }
                .company-info h1 { margin: 0; font-size: 20px; color: #1a73e8; letter-spacing: 0.5px; }
                .company-info p { margin: 0; font-size: 10px; color: #555; }
                
                .report-meta { text-align: right; }
                .report-meta h2 { margin: 0; font-size: 16px; color: #333; text-transform: uppercase; }
                .report-meta .badge { display: inline-block; background: #e8f0fe; color: #1a73e8; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-top: 5px; }

                .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e0e0e0; }
                .info-item { display: flex; flex-direction: column; }
                .info-label { font-size: 9px; color: #777; text-transform: uppercase; font-weight: bold; }
                .info-value { font-size: 11px; color: #333; font-weight: 500; }

                table.data-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                table.data-table th { background: #f1f3f4; color: #202124; padding: 6px 4px; text-align: center; border: 1px solid #dadce0; font-size: 10px; text-transform: uppercase; }
                table.data-table td { padding: 5px 4px; border: 1px solid #dadce0; text-align: center; font-size: 10px; }
                table.data-table tr:nth-child(even) { background: #fafafa; }
                .text-start { text-align: left !important; padding-left: 8px !important; }
                .text-end { text-align: right !important; padding-right: 8px !important; }

                .totals-row { background: #eee !important; font-weight: bold; font-size: 11px; }
                .totals-row td { border-top: 2px solid #444 !important; }

                .footer { margin-top: 40px; display: flex; justify-content: space-between; gap: 50px; }
                .sig-box { flex: 1; border-top: 1px solid #999; text-align: center; padding-top: 8px; font-size: 10px; color: #666; }
                
                .print-footer { margin-top: 20px; border-top: 1px solid #eee; padding-top: 5px; font-size: 8px; color: #aaa; text-align: center; }
            </style>
        </head>
        <body>
            <div class="print-container">
                <div class="header-wrapper">
                    <div class="logo-section">
                        ${company.logo ? `<img src="${company.logo}" style="max-height: 50px; max-width: 150px;">` : `<div class="logo-placeholder">${company.companyName[0]}</div>`}
                        <div class="company-info">
                            <h1>${company.companyName}</h1>
                            <p>${company.address || ''}</p>
                            <p>Phone: ${company.phone || ''} ${company.email ? '| Email: ' + company.email : ''}</p>
                        </div>
                    </div>
                    <div class="report-meta">
                        <h2>Commission Details</h2>
                        <div class="badge">${state.currentTab.replace(/_/g, ' ').toUpperCase()}</div>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Branch</span>
                        <span class="info-value">${branch}${subBranch}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Department</span>
                        <span class="info-value">${dept}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Period</span>
                        <span class="info-value">${month}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${catInfo ? 'Category' : 'Generated At'}</span>
                        <span class="info-value">${catInfo ? catInfo.replace('Category: ', '') : new Date().toLocaleString()}</span>
                    </div>
                </div>

                <table class="data-table">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                ${row.map((cell, idx) => `
                                    <td class="${idx === 1 ? 'text-start' : (idx === row.length - 1 ? 'text-end fw-bold' : '')}">
                                        ${cell}
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="totals-row">
                            <td colspan="${headers.length - 1}" class="text-end">GRAND TOTAL</td>
                            <td class="text-end">${totalInList.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="footer">
                    <div class="sig-box">Prepared By</div>
                    <div class="sig-box">Store Manager</div>
                    <div class="sig-box">Authorized Signature</div>
                </div>

                <div class="print-footer">
                    Generated via BAS Software System | User: ${document.getElementById('userName')?.textContent || 'System'} | Date: ${new Date().toLocaleString()}
                </div>
            </div>

            <script>
                window.onload = () => {
                    setTimeout(() => { 
                        window.print(); 
                        setTimeout(() => window.close(), 500);
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function showLoading() { }
function hideLoading() { }
function isAuthenticated() {
    return !!localStorage.getItem('token');
}
