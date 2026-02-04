let employees = [];
let departments = [];
let designations = [];
let stores = [];

async function loadStores() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores?showAll=true&t=' + Date.now(), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            stores = data.data;
            const filter = document.getElementById('filterBranch');
            if (filter) {
                stores.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.name;
                    opt.textContent = s.name;
                    filter.appendChild(opt);
                });
            }
        }
    } catch (err) { console.error(err); }
}

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadStores(),
        loadDepartments(),
        loadDesignations(),
        loadEmployees()
    ]);
});

async function loadDepartments() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-departments?t=' + Date.now(), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            departments = data.data;
            const filter = document.getElementById('filterDept');
            departments.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.textContent = d.name;
                filter.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function loadDesignations() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/designations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            designations = data.data;
            const filter = document.getElementById('filterDesig');
            designations.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.textContent = d.name;
                filter.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const branch = document.getElementById('filterBranch').value;
        const code = document.getElementById('filterCode').value;
        const name = document.getElementById('filterName').value;
        const dept = document.getElementById('filterDept').value;
        const desig = document.getElementById('filterDesig').value;
        const type = document.getElementById('filterType').value;
        const religion = document.getElementById('filterReligion').value;
        const status = document.getElementById('filterStatus').value;

        let url = `/api/v1/employees?branch=${branch}&code=${code}&name=${name}&department=${dept}&designation=${desig}&type=${type}&religion=${religion}&maritalStatus=${status}&t=${Date.now()}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            employees = data.data;
            renderTable();
        }
    } catch (err) {
        console.error('Error loading employees:', err);
    }
}

function handleGlobalSearch(value) {
    const filter = value.toUpperCase();
    const rows = document.getElementById('employeeTableBody').getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent || rows[i].innerText;
        if (text.toUpperCase().indexOf(filter) > -1) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}

function renderTable() {
    const tbody = document.getElementById('employeeTableBody');
    tbody.innerHTML = '';

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const rights = user.rights || {};
    const permissions = user.permissions || [];
    // Strictly check for right_02 (Allow Access Employee Para) even for admins
    const canEditParas = rights['right_02'] || permissions.includes('right_02');

    employees.forEach((emp, index) => {
        const tr = document.createElement('tr');
        tr.dataset.id = emp._id;

        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td class="text-center">
                <span class="code-link" onclick="gotoEdit('${emp._id}')">${emp.code || '-'}</span>
            </td>
            <td class="text-center">
                <button class="btn btn-success btn-xs" onclick="quickSave('${emp._id}', this)">Save</button>
            </td>
            <td>
                <select class="form-control form-control-xs col-branch" ${!canEditParas ? 'disabled' : ''}>
                    <option value="">Select Branch</option>
                    ${stores.map(s => `<option value="${s.name}" ${emp.branch === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" class="form-control form-control-xs col-name" value="${emp.name || ''}" readonly style="background-color: #f1f1f1;"></td>
            <td><input type="text" class="form-control form-control-xs col-cnic" value="${emp.cnic || ''}" readonly style="background-color: #f1f1f1;"></td>
            <td>
                <select class="form-control form-control-xs col-marital" ${!canEditParas ? 'disabled' : ''}>
                    <option value="Married" ${emp.maritalStatus === 'Married' ? 'selected' : ''}>Married</option>
                    <option value="Single" ${emp.maritalStatus === 'Single' ? 'selected' : ''}>Single</option>
                </select>
            </td>
            <td>
                <select class="form-control form-control-xs col-desig" ${!canEditParas ? 'disabled' : ''}>
                    <option value="">Select Designation</option>
                    ${designations.map(d => `<option value="${d._id}" ${emp.designation?._id === d._id ? 'selected' : ''}>${d.name}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="form-control form-control-xs col-dept" ${!canEditParas ? 'disabled' : ''}>
                    <option value="">Select Department</option>
                    ${departments.map(d => `<option value="${d._id}" ${emp.department?._id === d._id ? 'selected' : ''}>${d.name}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" class="form-control form-control-xs col-acNo" value="${emp.acNo || ''}" ${!canEditParas ? 'readonly' : ''}></td>
            <td>
                <select class="form-control form-control-xs col-bank" ${!canEditParas ? 'disabled' : ''}>
                    <option value="" ${!emp.selectBank ? 'selected' : ''}>Select Bank</option>
                    <option value="HBL" ${emp.selectBank === 'HBL' ? 'selected' : ''}>HBL</option>
                    <option value="ALF" ${emp.selectBank === 'ALF' ? 'selected' : ''}>ALF</option>
                    <option value="BOP" ${emp.selectBank === 'BOP' ? 'selected' : ''}>BOP</option>
                </select>
            </td>
            <td><input type="text" class="form-control form-control-xs col-duty" value="${getDutyHours(emp)}" readonly style="background-color: #f1f1f1;"></td>
            <td><input type="date" class="form-control form-control-xs col-incrDate" value="${emp.incrDate ? emp.incrDate.split('T')[0] : ''}" ${!canEditParas ? 'readonly' : ''}></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-salary" style="font-size: 0.72rem;" value="${emp.basicSalary || 0}" ${!canEditParas ? 'readonly' : ''} oninput="updateRowIncrDate(this)"></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-comm" style="font-size: 0.72rem; background: #f8fbff;" value="${emp.commission || 0}" readonly title="Direct edit locked"></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-fixAllow" style="font-size: 0.72rem;" value="${emp.fixAllowance || 0}" ${!canEditParas ? 'readonly' : ''}></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-st" style="font-size: 0.72rem;" value="${emp.stLoss || 0}" ${!canEditParas ? 'readonly' : ''}></td>
            <td class="text-center"><input type="checkbox" class="col-active" ${!canEditParas ? 'disabled' : ''} ${emp.isActive !== false ? 'checked' : ''}></td>
            <td class="text-center"><input type="checkbox" class="col-pfstb" ${!canEditParas ? 'disabled' : ''} ${emp.payFullSalaryThroughBank ? 'checked' : ''}></td>
            <td class="text-center"><input type="checkbox" class="col-eobi" ${!canEditParas ? 'disabled' : ''} ${emp.eobi ? 'checked' : ''}></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateRowIncrDate(salaryInput) {
    const tr = salaryInput.closest('tr');
    const dateInput = tr.querySelector('.col-incrDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
}

async function quickSave(id, btn) {
    const tr = btn.closest('tr');
    const branch = tr.querySelector('.col-branch').value;

    if (!branch || branch === "") {
        alert('Mandatory Field: Please select a Branch before saving.');
        tr.querySelector('.col-branch').focus();
        return;
    }

    const updatedData = {
        branch: branch,
        name: tr.querySelector('.col-name').value,
        cnic: tr.querySelector('.col-cnic').value,
        maritalStatus: tr.querySelector('.col-marital').value,
        designation: tr.querySelector('.col-desig').value || null,
        department: tr.querySelector('.col-dept').value || null,
        acNo: tr.querySelector('.col-acNo').value,
        selectBank: tr.querySelector('.col-bank').value,
        basicSalary: parseFloat(tr.querySelector('.col-salary').value) || 0,
        fixAllowance: parseFloat(tr.querySelector('.col-fixAllow').value) || 0,
        stLoss: parseFloat(tr.querySelector('.col-st').value) || 0,
        isActive: tr.querySelector('.col-active').checked,
        payFullSalaryThroughBank: tr.querySelector('.col-pfstb').checked,
        eobi: tr.querySelector('.col-eobi').checked,
        incrDate: tr.querySelector('.col-incrDate').value || null,
        totalHrs: tr.querySelector('.col-duty').value || ''
    };

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/employees/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedData)
        });

        const data = await res.json();
        if (data.success) {
            btn.textContent = 'Saved!';
            btn.classList.replace('btn-success', 'btn-primary');
            setTimeout(() => {
                location.reload(); // Force reload to show updated data from server
            }, 1000);
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Quick save error:', err);
        alert('Failed to update employee');
    }
}

function gotoEdit(id) {
    location.href = `employee-registration.html?id=${id}`;
}

function getDutyHours(emp) {
    if (!emp) return '';
    if (emp.totalHrs && emp.totalHrs !== '0h') return emp.totalHrs;
    if (emp.fDutyTime && emp.tDutyTime) {
        try {
            const [fH, fM] = emp.fDutyTime.split(':').map(Number);
            const [tH, tM] = emp.tDutyTime.split(':').map(Number);
            let diff = (tH * 60 + tM) - (fH * 60 + fM);
            if (diff < 0) diff += 1440;
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            return `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
        } catch (e) {
            return '';
        }
    }
    return emp.totalHrs || '';
}
