
// Employee Commission Management

let state = {
    currentTab: 'dep_item_wise',
    monthYear: new Date().toISOString().slice(0, 7),
    branch: '',
    department: 'Medicine',
    subBranch: '',
    data: [], // Current table data
    masterData: [], // Items or Employees
    items: [],
    employees: []
};

document.addEventListener('DOMContentLoaded', function () {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    setupGlobalFilters();
    loadBranches();
    loadMasterData().then(() => {
        setTab('dep_item_wise'); // Load default
    });
});

async function setupGlobalFilters() {
    const today = new Date();
    document.getElementById('mainMonthYear').value = today.toISOString().slice(0, 7);

    // Set default user
    if (localStorage.getItem('user')) {
        const user = JSON.parse(localStorage.getItem('user'));
        document.getElementById('userName').textContent = user.name || 'User';
    }
}

async function loadBranches() {
    // Mock branches or fetch if available. 
    const branches = ['Main Office', 'Warehouse', 'F-6', 'I-8', 'G-9'];
    const selects = ['mainBranch', 'itemSubBranch', 'empSubBranch', 'distSubBranch', 'rottiSubBranch', 'perksSubBranch'];

    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = '<option value="">Select Branch</option>';
            branches.forEach(b => {
                sel.innerHTML += `<option value="${b}">${b}</option>`;
            });
        }
    });

    // Default 'mainBranch' removed
}

async function loadMasterData() {
    try {
        const token = localStorage.getItem('token');

        // Load Items
        const resItems = await fetch('/api/v1/items?limit=2000', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resItems.ok) {
            const json = await resItems.json();
            state.items = json.data || [];
        }

        // Load Employees (Parties with type='employee' or specific endpoint)
        // Assuming we have /api/v1/employees or similar
        const resEmp = await fetch('/api/v1/employees?limit=1000', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resEmp.ok) {
            const json = await resEmp.json();
            state.employees = json.data || [];
        } else {
            // Fallback if generic parties point
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
    console.log("Switched to tab:", tabName);
    loadCurrentTab();
}

async function loadCurrentTab() {
    // Update State from UI
    state.monthYear = document.getElementById('mainMonthYear').value;
    state.branch = document.getElementById('mainBranch').value;
    state.department = document.getElementById('mainDepartment').value;

    // Sub branch depends on tab
    let subBranchId = '';
    if (state.currentTab === 'dep_item_wise') subBranchId = 'itemSubBranch';
    else if (state.currentTab === 'employee_wise') subBranchId = 'empSubBranch';
    else if (state.currentTab === 'distribute') subBranchId = 'distSubBranch';
    else if (state.currentTab === 'rotti_nashta') subBranchId = 'rottiSubBranch';
    else if (state.currentTab === 'rotti_perks') subBranchId = 'perksSubBranch';

    state.subBranch = document.getElementById(subBranchId)?.value || '';

    showLoading();

    try {
        const token = localStorage.getItem('token');
        const query = new URLSearchParams({
            monthYear: state.monthYear,
            branch: state.branch,
            department: state.department,
            subBranch: state.subBranch,
            type: state.currentTab
        });

        // 1. Fetch saved Data
        const res = await fetch(`/api/v1/employee-commissions?${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const json = await res.json();
        let savedData = json.data ? (json.data.data || []) : [];

        // 2. Merge with Master Data (Items or Employees)
        // If data is saved, we use it. If "Items" are missing in saved data but exist in Master, we assume we should SHOW them?
        // Usually creating a commission sheet starts with the master list.

        if (state.currentTab === 'dep_item_wise') {
            state.data = mergeWithMaster(state.items, savedData, 'item');
        } else {
            state.data = mergeWithMaster(state.employees, savedData, 'employee');
        }

        renderTable();

    } catch (e) {
        console.error(e);
        alert('Error loading data');
    } finally {
        hideLoading();
    }
}

function mergeWithMaster(masterList, savedList, type) {
    // Return a list where each master item is present, merged with saved values if any
    return masterList.map(m => {
        const saved = savedList.find(s => s.id === m._id.toString());
        return {
            id: m._id,
            name: m.name,
            code: m.code || m.sku || '',
            // Item Specifics
            price: saved ? saved.price : (m.salePrice || 0),
            qty: saved ? saved.qty : 0,
            total: saved ? saved.total : 0,
            // Employee Specifics
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

function renderTable() {
    const tab = state.currentTab;
    let tbodyId = '';
    let html = '';

    if (tab === 'dep_item_wise') {
        tbodyId = 'itemWiseBody';
        html = state.data.map((item, i) => `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${item.price}" onchange="updateRow('${i}', 'price', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${item.qty}" onchange="updateRow('${i}', 'qty', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${item.total}" readonly></td>
            </tr>
        `).join('');
    }
    else if (tab === 'employee_wise') {
        tbodyId = 'empWiseBody';
        let total = 0;
        html = state.data.map((emp, i) => {
            total += parseFloat(emp.commission || 0);
            return `
            <tr>
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.commission}" onchange="updateRow('${i}', 'commission', this.value)"></td>
                <td><button class="btn btn-sm btn-info"><i class="fas fa-save"></i></button></td>
            </tr>
        `}).join('');
        document.getElementById('empWiseTotal').textContent = total.toFixed(2);
    }
    else if (tab === 'distribute') {
        tbodyId = 'distributeBody';
        let t1 = 0, t2 = 0, t3 = 0, t4 = 0;
        html = state.data.map((emp, i) => {
            const tot = (parseFloat(emp.otherCommission) || 0) + (parseFloat(emp.ugCommission) || 0) + (parseFloat(emp.warehouseCommission) || 0);
            t1 += parseFloat(emp.otherCommission) || 0;
            t2 += parseFloat(emp.ugCommission) || 0;
            t3 += parseFloat(emp.warehouseCommission) || 0;
            t4 += tot;
            return `
            <tr>
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.otherCommission}" onchange="updateRow('${i}', 'otherCommission', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.ugCommission}" onchange="updateRow('${i}', 'ugCommission', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.warehouseCommission}" onchange="updateRow('${i}', 'warehouseCommission', this.value)"></td>
                <td class="fw-bold">${tot.toFixed(2)}</td>
            </tr>
        `}).join('');
        document.getElementById('distOtherTotal').innerText = t1.toFixed(2);
        document.getElementById('distUgTotal').innerText = t2.toFixed(2);
        document.getElementById('distWarehouseTotal').innerText = t3.toFixed(2);
        document.getElementById('distGrandTotal').innerText = t4.toFixed(2);
    }
    else if (tab === 'rotti_nashta') {
        tbodyId = 'rottiNashtaBody';
        let total = 0;
        html = state.data.map((emp, i) => {
            // Logic: Nashta Total = Nashta Days * Rate? Or static Inputs? 
            // Images show columns: Days, Nashta, Nashta Total. 
            // Assuming simplified input for now.
            const nTotal = parseFloat(emp.nashtaTotal) || 0;
            const rTotal = parseFloat(emp.rottiTotal) || 0;
            const grand = nTotal + rTotal;
            total += grand;
            return `
            <tr>
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.nashtaDays}" onchange="updateRow('${i}', 'nashtaDays', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.nashtaRate}" placeholder="Rate" onchange="updateRow('${i}', 'nashtaRate', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center bg-light" value="${nTotal}" readonly></td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.rottiDays}" onchange="updateRow('${i}', 'rottiDays', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" style="width:60px" value="${emp.rottiRate}" placeholder="Rate" onchange="updateRow('${i}', 'rottiRate', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center bg-light" value="${rTotal}" readonly></td>
                <td class="fw-bold">${grand.toFixed(2)}</td>
            </tr>
        `}).join('');
        document.getElementById('rottiNashtaTotal').innerText = total.toFixed(2);
    }
    else if (tab === 'rotti_perks') {
        tbodyId = 'rottiPerksBody';
        let total = 0;
        html = state.data.map((emp, i) => {
            const tot = parseFloat(emp.totalData) || 0;
            total += tot;
            return `
            <tr>
                <td>${i + 1}</td>
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.basicSalary}" onchange="updateRow('${i}', 'basicSalary', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.workedDays}" onchange="updateRow('${i}', 'workedDays', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.rottiRate}" placeholder="Rotti" onchange="updateRow('${i}', 'rottiRate', this.value)"></td> 
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.rottiTimes}" onchange="updateRow('${i}', 'rottiTimes', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.nashtaRate}" placeholder="Nashta" onchange="updateRow('${i}', 'nashtaRate', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.nashtaTotal}" onchange="updateRow('${i}', 'nashtaTotal', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" value="${emp.totalData}" onchange="updateRow('${i}', 'totalData', this.value)"></td>
            </tr>
        `}).join('');
        document.getElementById('rottiPerksGrandTotal').innerText = total.toFixed(2);
    }

    document.getElementById(tbodyId).innerHTML = html;
}

function updateRow(index, field, value) {
    const item = state.data[index];
    item[field] = parseFloat(value) || 0;

    // Auto calculations
    if (state.currentTab === 'dep_item_wise') {
        item.total = item.price * item.qty;
    }
    else if (state.currentTab === 'rotti_nashta') {
        // Simple mult logic: Days * Rate = Total? Or manual? 
        // Assuming manual or simple:
        item.nashtaTotal = item.nashtaDays * (item.nashtaRate || 0); // Simplified assumption
        item.rottiTotal = item.rottiDays * (item.rottiRate || 0);
    }

    renderTable(); // Re-render to show updates totals
}

async function saveCurrentTab() {
    const token = localStorage.getItem('token');

    // Filter out rows with all zeros to save space? Or save all?
    // Saving all guarantees consistency.

    const payload = {
        monthYear: state.monthYear,
        branch: state.branch,
        department: state.department,
        subBranch: state.subBranch,
        type: state.currentTab,
        fromDate: document.getElementById('perksFromDate')?.value,
        toDate: document.getElementById('perksToDate')?.value,
        data: state.data
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
            alert('Saved Successfully!');
            loadCurrentTab();
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

function showLoading() {
    // Implement loading overlay if not global
}

function hideLoading() {
    // Hide overlay
}

function isAuthenticated() {
    return !!localStorage.getItem('token');
}
