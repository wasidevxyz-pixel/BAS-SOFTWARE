let departments = [];
let designations = [];
let currentEmployeeId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadStores();
    await loadDepartments();
    await loadDesignations();
    await fetchNextCode();
    setDefaultDates();
    checkEmployeeListPermission();
    checkAccessParaPermission();

    // Check for ID in URL if redirected from list
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
        await editEmployee(id);
    } else {
        calculateTotalHours();
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            saveEmployee();
        }
    });
});

async function loadStores() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores?showAll=true', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('branch');
            select.innerHTML = '<option value="">Select Branch</option>';
            data.data.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store.name;
                opt.textContent = store.name;
                select.appendChild(opt);
            });
        }
    } catch (err) { console.error('Error loading stores:', err); }
}

async function fetchNextCode() {
    if (currentEmployeeId) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/employees/next-code?t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const codeInput = document.getElementById('code');
            codeInput.value = data.data;
        }
    } catch (err) { console.error('Fetch code error:', err); }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('joiningDate').value = today;
    document.getElementById('issueDate').value = today;
    document.getElementById('incrDate').value = today;
    document.getElementById('expiryDate').value = today;

    document.getElementById('fDutyTime').addEventListener('change', calculateTotalHours);
    document.getElementById('tDutyTime').addEventListener('change', calculateTotalHours);

    document.getElementById('selectBank').addEventListener('change', syncAccNo);
    ['bank_hbl', 'bank_alf', 'bank_bop', 'bank_bip', 'bank_bahl'].forEach(id => {
        document.getElementById(id).addEventListener('input', syncAccNo);
    });

    document.getElementById('basicSalary').addEventListener('input', () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('incrDate').value = today;
    });
}

function syncAccNo() {
    const selectedBank = document.getElementById('selectBank').value;
    const acNoInput = document.getElementById('acNo');
    if (!selectedBank) { acNoInput.value = ''; return; }
    const bankInputId = `bank_${selectedBank.toLowerCase()}`;
    const bankVal = document.getElementById(bankInputId).value;
    acNoInput.value = bankVal;
}

function calculateTotalHours() {
    const fromTime = document.getElementById('fDutyTime').value;
    const toTime = document.getElementById('tDutyTime').value;
    const totalHrsInput = document.getElementById('totalHrs');
    if (!fromTime || !toTime) { totalHrsInput.value = ''; return; }
    const [fromH, fromM] = fromTime.split(':').map(Number);
    const [toH, toM] = toTime.split(':').map(Number);
    let diffMin = (toH * 60 + toM) - (fromH * 60 + fromM);
    if (diffMin < 0) diffMin += 24 * 60;
    const hours = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;
    totalHrsInput.value = `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`.trim();
}

async function loadDepartments() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            departments = data.data;
            const select = document.getElementById('department');
            const savedVal = select.value;
            select.innerHTML = '<option value="">Select Department</option>';
            departments.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.textContent = d.name;
                select.appendChild(opt);
            });
            if (savedVal) select.value = savedVal;
            renderDeptList();
        }
    } catch (err) { console.error('Error loading departments:', err); }
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
            const select = document.getElementById('designation');
            const savedVal = select.value;
            select.innerHTML = '<option value="">Select Designation</option>';
            designations.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.textContent = d.name;
                select.appendChild(opt);
            });
            if (savedVal) select.value = savedVal;
            renderDesignationList();
        }
    } catch (err) { console.error('Error loading designations:', err); }
}

function openDeptModal() {
    const nameInput = document.getElementById('newDeptName');
    delete nameInput.dataset.id;
    nameInput.value = '';
    document.getElementById('saveDeptBtn').textContent = 'Save';
    new bootstrap.Modal(document.getElementById('deptModal')).show();
    renderDeptList();
}

function openDeptList() { openDeptModal(); }

function renderDeptList() {
    const container = document.getElementById('deptListContainer');
    if (!container) return;
    container.innerHTML = departments.map(d => `
        <div class="list-group-item d-flex justify-content-between align-items-center py-2">
            <span class="fw-bold" style="font-size:0.85rem;">${d.name}</span>
            <div>
                <button type="button" class="btn btn-sm btn-outline-primary p-1 py-0 me-1" onclick="editDept('${d._id}', '${d.name}')"><i class="fas fa-edit"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger p-1 py-0" onclick="deleteDept('${d._id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('') || '<div class="p-3 text-center text-muted small">No departments found</div>';
}

async function saveNewDepartment() {
    const nameInput = document.getElementById('newDeptName');
    const name = nameInput.value;
    const id = nameInput.dataset.id;
    if (!name) return;
    try {
        const token = localStorage.getItem('token');
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/v1/employee-departments/${id}` : '/api/v1/employee-departments';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            nameInput.value = '';
            delete nameInput.dataset.id;
            document.getElementById('saveDeptBtn').textContent = 'Save';
            await loadDepartments();
        }
    } catch (err) { console.error(err); }
}

function editDept(id, name) {
    const nameInput = document.getElementById('newDeptName');
    nameInput.value = name;
    nameInput.dataset.id = id;
    document.getElementById('saveDeptBtn').textContent = 'Update';
}

async function deleteDept(id) {
    if (!confirm('Delete department?')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/employee-departments/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) { await loadDepartments(); }
    } catch (err) { console.error(err); }
}

function openDesigModal() {
    const input = document.getElementById('newDesigName');
    delete input.dataset.id;
    input.value = '';
    document.getElementById('saveDesigBtn').textContent = 'Save';
    new bootstrap.Modal(document.getElementById('desigModal')).show();
    renderDesignationList();
}

function openDesigList() { openDesigModal(); }

function renderDesignationList() {
    const container = document.getElementById('desigListContainer');
    if (!container) return;
    container.innerHTML = designations.map(d => `
        <div class="list-group-item d-flex justify-content-between align-items-center py-2">
            <span class="fw-bold" style="font-size:0.85rem;">${d.name}</span>
            <div>
                <button type="button" class="btn btn-sm btn-outline-primary p-1 py-0 me-1" onclick="editDesig('${d._id}', '${d.name}')"><i class="fas fa-edit"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger p-1 py-0" onclick="deleteDesig('${d._id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('') || '<div class="p-3 text-center text-muted small">No designations found</div>';
}

async function saveNewDesignation() {
    const input = document.getElementById('newDesigName');
    const name = input.value;
    const id = input.dataset.id;
    if (!name) return;
    try {
        const token = localStorage.getItem('token');
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/v1/designations/${id}` : '/api/v1/designations';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            input.value = '';
            delete input.dataset.id;
            document.getElementById('saveDesigBtn').textContent = 'Save';
            await loadDesignations();
        }
    } catch (err) { console.error(err); }
}

function editDesig(id, name) {
    const input = document.getElementById('newDesigName');
    input.value = name;
    input.dataset.id = id;
    document.getElementById('saveDesigBtn').textContent = 'Update';
}

async function deleteDesig(id) {
    if (!confirm('Delete designation?')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/designations/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) { await loadDesignations(); }
    } catch (err) { console.error(err); }
}

async function saveEmployee() {
    const requiredFields = {
        'name': 'Employee Name',
        'branch': 'Branch',
        'department': 'Department',
        'designation': 'Designation',
        'incrDate': 'Increment Date',
        'joiningDate': 'Joining Date',
        'gender': 'Gender',
        'religion': 'Religion',
        'maritalStatus': 'Marital Status',
        'fDutyTime': 'From Duty Time',
        'tDutyTime': 'To Duty Time'
    };

    for (const [id, label] of Object.entries(requiredFields)) {
        const val = document.getElementById(id).value;
        if (!val || val === 'Select Branch' || val === '') {
            alert(`Please fill mandatory field: ${label}`);
            document.getElementById(id).focus();
            return;
        }
    }

    const employeeData = {
        code: document.getElementById('code').value,
        name: document.getElementById('name').value,
        fatherName: document.getElementById('fatherName').value,
        cnic: document.getElementById('cnic').value,
        branch: document.getElementById('branch').value,
        department: document.getElementById('department').value,
        designation: document.getElementById('designation').value,
        address: document.getElementById('address').value,
        acNo: document.getElementById('acNo').value,
        selectBank: document.getElementById('selectBank').value,
        mobileNo: document.getElementById('mobileNo').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        issueDate: document.getElementById('issueDate').value,
        joiningDate: document.getElementById('joiningDate').value,
        incrDate: document.getElementById('incrDate').value,
        expiryDate: document.getElementById('expiryDate').value,
        gender: document.getElementById('gender').value,
        religion: document.getElementById('religion').value,
        maritalStatus: document.getElementById('maritalStatus').value,
        isActive: document.getElementById('isActive').checked,
        commEmp: document.getElementById('isSalesman').checked,

        opening: parseFloat(document.getElementById('opening').value) || 0,
        basicSalary: parseFloat(document.getElementById('basicSalary').value) || 0,
        salaryType: document.getElementById('salaryType').value,
        stLoss: parseFloat(document.getElementById('stLoss').value) || 0,
        fixAllowance: parseFloat(document.getElementById('fixAllowance').value) || 0,
        otherAllowance: parseFloat(document.getElementById('otherAllowance').value) || 0,
        allowFood: document.getElementById('allowFood').value,
        foodAllowanceRs: parseFloat(document.getElementById('foodAllowanceRs').value) || 0,
        bankCash: document.getElementById('bankCash').value,
        deduction: parseFloat(document.getElementById('deduction').value) || 0,
        securityDeposit: parseFloat(document.getElementById('securityDeposit').value) || 0,
        fDutyTime: document.getElementById('fDutyTime').value,
        tDutyTime: document.getElementById('tDutyTime').value,
        offDay: document.getElementById('offDay').value,
        totalHrs: document.getElementById('totalHrs').value,

        allowOvertime: document.getElementById('allowOvertime').checked,
        otst30WorkingDays: document.getElementById('otst30WorkingDays').checked,
        eobi: document.getElementById('eobi').checked,
        payFullSalaryThroughBank: document.getElementById('payFullSalaryThroughBank').checked,
        electricityBill: document.getElementById('electricityBill').checked,
        thirtyWorkingDays: document.getElementById('thirtyWorkingDays').checked,
        allowEmployeeAdvance: document.getElementById('allowEmployeeAdvance').checked,
        allowRottiPerks: document.getElementById('allowRottiPerks').checked,
        dontAllowRottiPerks: document.getElementById('dontAllowRottiPerks').checked,
        allowNashtaPerks: document.getElementById('allowNashtaPerks').checked,
        dontAllowNashtaPerks: document.getElementById('dontAllowNashtaPerks').checked,
        rottiTimes: parseInt(document.getElementById('rottiTimes').value) || 0,

        bankDetails: {
            hbl: document.getElementById('bank_hbl').value,
            alf: document.getElementById('bank_alf').value,
            bop: document.getElementById('bank_bop').value,
            bip: document.getElementById('bank_bip').value,
            bahl: document.getElementById('bank_bahl').value
        }
    };

    try {
        const token = localStorage.getItem('token');
        const method = currentEmployeeId ? 'PUT' : 'POST';
        const url = currentEmployeeId ? `/api/v1/employees/${currentEmployeeId}` : '/api/v1/employees';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(employeeData)
        });
        const result = await res.json();
        if (result.success) {
            alert(currentEmployeeId ? 'Employee Updated!' : 'Employee Saved!');
            clearForm();
        } else { alert('Error: ' + result.message); }
    } catch (err) { console.error('Save error:', err); alert('Failed to save'); }
}

async function editEmployee(id) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/employees/${id}?t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const emp = data.data;
            currentEmployeeId = emp._id;
            document.getElementById('code').value = emp.code || '';
            document.getElementById('name').value = emp.name || '';
            document.getElementById('fatherName').value = emp.fatherName || '';
            document.getElementById('cnic').value = emp.cnic || '';
            document.getElementById('branch').value = emp.branch || '';
            document.getElementById('department').value = emp.department?._id || '';
            document.getElementById('designation').value = emp.designation?._id || '';
            document.getElementById('address').value = emp.address || '';
            document.getElementById('acNo').value = emp.acNo || '';
            document.getElementById('selectBank').value = emp.selectBank || '';
            document.getElementById('mobileNo').value = emp.mobileNo || '';
            document.getElementById('dateOfBirth').value = emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '';
            document.getElementById('issueDate').value = emp.issueDate ? emp.issueDate.split('T')[0] : '';
            document.getElementById('joiningDate').value = emp.joiningDate ? emp.joiningDate.split('T')[0] : '';
            document.getElementById('incrDate').value = emp.incrDate ? emp.incrDate.split('T')[0] : '';
            document.getElementById('expiryDate').value = emp.expiryDate ? emp.expiryDate.split('T')[0] : '';
            document.getElementById('gender').value = emp.gender || 'Male';
            document.getElementById('religion').value = emp.religion || 'Islam';
            document.getElementById('maritalStatus').value = emp.maritalStatus || 'Married';
            document.getElementById('isActive').checked = emp.isActive !== false;
            document.getElementById('isSalesman').checked = emp.commEmp || false;

            document.getElementById('opening').value = emp.opening || 0;
            document.getElementById('basicSalary').value = emp.basicSalary || 0;
            document.getElementById('salaryType').value = emp.salaryType || 'Per Month';
            document.getElementById('stLoss').value = emp.stLoss || 0;
            document.getElementById('fixAllowance').value = emp.fixAllowance || 0;
            document.getElementById('otherAllowance').value = emp.otherAllowance || 0;
            document.getElementById('allowFood').value = emp.allowFood || 'No Food';
            document.getElementById('foodAllowanceRs').value = emp.foodAllowanceRs || 0;
            document.getElementById('bankCash').value = emp.bankCash || 'Cash';
            document.getElementById('deduction').value = emp.deduction || 0;
            document.getElementById('securityDeposit').value = emp.securityDeposit || 0;
            document.getElementById('fDutyTime').value = emp.fDutyTime || '09:00';
            document.getElementById('tDutyTime').value = emp.tDutyTime || '21:00';
            document.getElementById('offDay').value = emp.offDay || 'Sunday';
            calculateTotalHours();

            document.getElementById('allowOvertime').checked = emp.allowOvertime || false;
            document.getElementById('otst30WorkingDays').checked = emp.otst30WorkingDays || false;
            document.getElementById('eobi').checked = emp.eobi || false;
            document.getElementById('payFullSalaryThroughBank').checked = emp.payFullSalaryThroughBank || false;
            document.getElementById('electricityBill').checked = emp.electricityBill || false;
            document.getElementById('thirtyWorkingDays').checked = emp.thirtyWorkingDays || false;
            document.getElementById('allowEmployeeAdvance').checked = emp.allowEmployeeAdvance || false;
            document.getElementById('allowRottiPerks').checked = emp.allowRottiPerks || false;
            document.getElementById('dontAllowRottiPerks').checked = emp.dontAllowRottiPerks || false;
            document.getElementById('allowNashtaPerks').checked = emp.allowNashtaPerks || false;
            document.getElementById('dontAllowNashtaPerks').checked = emp.dontAllowNashtaPerks || false;
            document.getElementById('rottiTimes').value = emp.rottiTimes || 0;

            if (emp.bankDetails) {
                document.getElementById('bank_hbl').value = emp.bankDetails.hbl || '';
                document.getElementById('bank_alf').value = emp.bankDetails.alf || '';
                document.getElementById('bank_bop').value = emp.bankDetails.bop || '';
                document.getElementById('bank_bip').value = emp.bankDetails.bip || '';
                document.getElementById('bank_bahl').value = emp.bankDetails.bahl || '';
            }
        }
    } catch (err) { console.error('Edit error:', err); }
}

function clearForm() {
    currentEmployeeId = null;
    document.getElementById('employeeForm').reset();

    // Clear URL to prevent re-loading on refresh
    window.history.pushState({}, document.title, window.location.pathname);

    // Reset Photo
    document.getElementById('photoInput').value = '';
    document.getElementById('photoPreview').innerHTML = '<div class="photo-placeholder"><i class="fas fa-camera"></i></div>';

    setDefaultDates();
    fetchNextCode();

    // Set Access Control Defaults
    document.getElementById('allowOvertime').checked = true;
    document.getElementById('otst30WorkingDays').checked = true;
    document.getElementById('allowEmployeeAdvance').checked = true;

    // Set Profile Defaults
    document.getElementById('gender').value = 'Male';
    document.getElementById('religion').value = 'Islam';
    document.getElementById('maritalStatus').value = 'Married';

    calculateTotalHours();
}

function previewPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('photoPreview');
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function checkEmployeeListPermission() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const rights = user.rights || {};
    const permissions = user.permissions || [];

    // Strictly check for right_23 (Allow Employee List) even for admins
    const hasPermission = rights['right_23'] || permissions.includes('right_23');

    const listBtn = document.getElementById('btnEmployeeList');
    if (listBtn) {
        if (hasPermission) {
            listBtn.style.display = 'block'; // Or however you want to show it
        } else {
            listBtn.style.display = 'none';
        }
    }
}

function checkAccessParaPermission() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const rights = user.rights || {};
    const permissions = user.permissions || [];

    // Strictly check for right_02 (Allow Access Employee Para) even for admins
    const hasPermission = rights['right_02'] || permissions.includes('right_02');

    const section = document.getElementById('accessControlsSection');
    if (section) {
        // Disable all inputs and checkboxes within this container if no permission
        const inputs = section.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.disabled = !hasPermission;
        });
    }
}
