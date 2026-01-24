let employees = [];
let departments = [];
let designations = [];
let stores = [];

async function loadStores() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores?showAll=true', {
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
        const response = await fetch('/api/v1/employee-departments', {
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

        let url = `/api/v1/employees?branch=${branch}&code=${code}&name=${name}&department=${dept}&designation=${desig}&type=${type}&religion=${religion}&maritalStatus=${status}`;

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
                <select class="form-control form-control-xs col-branch">
                    <option value="">-</option>
                    ${stores.map(s => `<option value="${s.name}" ${emp.branch === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" class="form-control form-control-xs col-name" value="${emp.name || ''}" readonly></td>
            <td><input type="text" class="form-control form-control-xs col-cnic" value="${emp.cnic || ''}" readonly></td>
            <td>
                <select class="form-control form-control-xs col-marital" disabled>
                    <option value="Married" ${emp.maritalStatus === 'Married' ? 'selected' : ''}>Married</option>
                    <option value="Single" ${emp.maritalStatus === 'Single' ? 'selected' : ''}>Single</option>
                </select>
            </td>
            <td>
                <select class="form-control form-control-xs col-desig" disabled>
                    <option value="">-</option>
                    ${designations.map(d => `<option value="${d._id}" ${emp.designation?._id === d._id ? 'selected' : ''}>${d.name}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="form-control form-control-xs col-dept" disabled>
                    <option value="">-</option>
                    ${departments.map(d => `<option value="${d._id}" ${emp.department?._id === d._id ? 'selected' : ''}>${d.name}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" class="form-control form-control-xs col-acNo" value="${emp.acNo || ''}" readonly></td>
            <td>
                <select class="form-control form-control-xs col-bank" disabled>
                    <option value="" ${!emp.selectBank ? 'selected' : ''}>-</option>
                    <option value="HBL" ${emp.selectBank === 'HBL' ? 'selected' : ''}>HBL</option>
                    <option value="ALF" ${emp.selectBank === 'ALF' ? 'selected' : ''}>ALF</option>
                    <option value="BOP" ${emp.selectBank === 'BOP' ? 'selected' : ''}>BOP</option>
                </select>
            </td>
            <td><input type="text" class="form-control form-control-xs col-duty" value="${emp.totalHrs || ''}" readonly></td>
            <td><input type="date" class="form-control form-control-xs col-incrDate" value="${emp.incrDate ? emp.incrDate.split('T')[0] : ''}" readonly></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-salary" style="font-size: 0.72rem;" value="${emp.basicSalary || 0}"></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-comm" style="font-size: 0.72rem; background: #f8fbff;" value="${emp.commission || 0}" readonly title="Direct edit locked"></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-fixAllow" style="font-size: 0.72rem;" value="${emp.fixAllowance || 0}"></td>
            <td><input type="number" class="form-control form-control-sm border-0 text-end w-100 col-st" style="font-size: 0.72rem;" value="${emp.stLoss || 0}"></td>
            <td class="text-center"><input type="checkbox" class="col-active" disabled ${emp.isActive !== false ? 'checked' : ''}></td>
            <td class="text-center"><input type="checkbox" class="col-pfstb" disabled ${emp.payFullSalaryThroughBank ? 'checked' : ''}></td>
            <td class="text-center"><input type="checkbox" class="col-eobi" disabled ${emp.eobi ? 'checked' : ''}></td>
        `;
        tbody.appendChild(tr);
    });
}

async function quickSave(id, btn) {
    const tr = btn.closest('tr');
    const updatedData = {
        branch: tr.querySelector('.col-branch').value,
        name: tr.querySelector('.col-name').value,
        cnic: tr.querySelector('.col-cnic').value,
        maritalStatus: tr.querySelector('.col-marital').value,
        designation: tr.querySelector('.col-desig').value || null,
        department: tr.querySelector('.col-dept').value || null,
        acNo: tr.querySelector('.col-acNo').value,
        selectBank: tr.querySelector('.col-bank').value,
        basicSalary: parseFloat(tr.querySelector('.col-salary').value) || 0,
        fixAllowance: parseFloat(tr.querySelector('.col-fixAllow').value) || 0,
        otherAllowance: parseFloat(tr.querySelector('.col-otherAllow').value) || 0,
        isActive: tr.querySelector('.col-active').checked,
        payFullSalaryThroughBank: tr.querySelector('.col-pfstb').checked,
        eobi: tr.querySelector('.col-eobi').checked,
        incrDate: tr.querySelector('.col-incrDate').value || null
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
                btn.textContent = 'Save';
                btn.classList.replace('btn-primary', 'btn-success');
            }, 2000);
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
