let employees = [];
let departments = [];

document.addEventListener('DOMContentLoaded', () => {
    loadDepartments();
    setDefaultDate();
});

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('joiningDate').value = today;
}

async function loadDepartments() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            departments = data.data.sort((a, b) => {
                const codeA = parseInt(a.code) || 999999;
                const codeB = parseInt(b.code) || 999999;
                return codeA - codeB || a.name.localeCompare(b.name);
            });
            const deptSelect = document.getElementById('department');
            deptSelect.innerHTML = '<option value="">Select Department</option>';
            departments.forEach(dept => {
                // Filter: Hide specialized internal departments
                if (dept.name === 'PERCENTAGE CASH' || dept.name === 'CASH REC FROM COUNTER') return;

                // Filter: Hide if only 'Closing_2_Comp_Sale' is set
                if (dept.closing2CompSale && !dept.closing2DeptDropDown) return;

                const option = document.createElement('option');
                option.value = dept._id;
                option.textContent = dept.name;
                deptSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

async function saveEmployee() {
    const employeeId = document.getElementById('employeeId').value;
    const employeeData = {
        name: document.getElementById('name').value,
        fatherName: document.getElementById('fatherName').value,
        cnic: document.getElementById('cnic').value,
        department: document.getElementById('department').value,
        designation: document.getElementById('designation').value,
        address: document.getElementById('address').value,
        accNo: document.getElementById('accNo').value,
        mobileNo: document.getElementById('mobileNo').value,
        resPhone: document.getElementById('resPhone').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        joiningDate: document.getElementById('joiningDate').value,
        resignDate: document.getElementById('resignDate').value,
        gender: document.getElementById('gender').value,
        religion: document.getElementById('religion').value,
        domicile: document.getElementById('domicile').value,

        // Salary fields
        basicSalary: parseFloat(document.getElementById('basicSalary').value) || 0,
        tcAllowance: parseFloat(document.getElementById('tcAllowance').value) || 0,
        otherAllowance: parseFloat(document.getElementById('otherAllowance').value) || 0,
        areaAllowance: parseFloat(document.getElementById('areaAllowance').value) || 0,
        otherDeduction: parseFloat(document.getElementById('otherDeduction').value) || 0,
        bankCity: document.getElementById('bankCity').value,
        securityDeposit: parseFloat(document.getElementById('securityDeposit').value) || 0,

        // Other Information
        areaCity: document.getElementById('areaCity').value,
        ref1Name: document.getElementById('ref1Name').value,
        ref1Phone: document.getElementById('ref1Phone').value,
        ref1Address: document.getElementById('ref1Address').value,
        ref2Name: document.getElementById('ref2Name').value,
        ref2Phone: document.getElementById('ref2Phone').value,
        ref2Address: document.getElementById('ref2Address').value,

        // Access Controls
        allowOvertime: document.getElementById('allowOvertime').checked,
        gtst: document.getElementById('gtst').checked,
        eobi: document.getElementById('eobi').checked,
        payProficiency: document.getElementById('payProficiency').checked,
        discountBill: document.getElementById('discountBill').checked,
        threeWorkingDays: document.getElementById('threeWorkingDays').checked,
        allowEmployeeAdvance: document.getElementById('allowEmployeeAdvance').checked,
        allowSalePerks: document.getElementById('allowSalePerks').checked,
        readOtherSalePerks: document.getElementById('readOtherSalePerks').checked,
        readOtherPerks: document.getElementById('readOtherPerks').checked,
        isActive: document.getElementById('isActive').checked,

        // Bank Details
        dbl: document.getElementById('dbl').value,
        alf: document.getElementById('alf').value,
        hbf: document.getElementById('hbf').value,
        stf: document.getElementById('stf').value,
        bank: document.getElementById('bank').value
    };

    if (!employeeData.name) {
        alert('Please enter employee name');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const url = employeeId ? `/api/v1/employees/${employeeId}` : '/api/v1/employees';
        const method = employeeId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(employeeData)
        });

        const data = await response.json();

        if (data.success) {
            alert(employeeId ? 'Employee updated successfully' : 'Employee created successfully');
            clearForm();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error saving employee:', error);
        alert('Error saving employee');
    }
}

async function showList() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            employees = data.data;
            renderEmployeeList();
            const modal = new bootstrap.Modal(document.getElementById('employeeListModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        alert('Error loading employees');
    }
}

function renderEmployeeList() {
    const tbody = document.getElementById('employeeListBody');
    tbody.innerHTML = '';

    employees.forEach(emp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${emp.code || '-'}</td>
            <td>${emp.name}</td>
            <td>${emp.department?.name || '-'}</td>
            <td>${emp.designation || '-'}</td>
            <td>${emp.basicSalary || 0}</td>
            <td>${emp.mobileNo || '-'}</td>
            <td>${emp.isActive ? 'Yes' : 'No'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEmployee('${emp._id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteEmployee('${emp._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function editEmployee(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employees/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const emp = data.data;
            document.getElementById('employeeId').value = emp._id;
            document.getElementById('code').value = emp.code || '';
            document.getElementById('name').value = emp.name;
            document.getElementById('fatherName').value = emp.fatherName || '';
            document.getElementById('cnic').value = emp.cnic || '';
            document.getElementById('branch').value = emp.branch || 'F-6';
            document.getElementById('department').value = emp.department?._id || '';
            document.getElementById('designation').value = emp.designation || '';
            document.getElementById('basicSalary').value = emp.basicSalary || 0;
            document.getElementById('mobileNo').value = emp.mobileNo || '';
            document.getElementById('address').value = emp.address || '';
            document.getElementById('joiningDate').value = emp.joiningDate ? emp.joiningDate.split('T')[0] : '';
            document.getElementById('dateOfBirth').value = emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '';
            document.getElementById('gender').value = emp.gender || 'Male';
            document.getElementById('allowOvertime').checked = emp.allowOvertime || false;
            document.getElementById('gtst').checked = emp.gtst || false;
            document.getElementById('eobi').checked = emp.eobi || false;
            document.getElementById('payProficiency').checked = emp.payProficiency || false;
            document.getElementById('discountBill').checked = emp.discountBill || false;
            document.getElementById('threeWorkingDays').checked = emp.threeWorkingDays || false;
            document.getElementById('allowEmployeeAdvance').checked = emp.allowEmployeeAdvance || false;
            document.getElementById('isActive').checked = emp.isActive;

            bootstrap.Modal.getInstance(document.getElementById('employeeListModal')).hide();
        }
    } catch (error) {
        console.error('Error loading employee:', error);
        alert('Error loading employee');
    }
}

async function deleteEmployee(id) {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employees/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            alert('Employee deleted successfully');
            showList();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Error deleting employee');
    }
}

function clearForm() {
    document.getElementById('employeeId').value = '';
    document.getElementById('code').value = '';
    document.getElementById('name').value = '';
    document.getElementById('fatherName').value = '';
    document.getElementById('cnic').value = '';
    document.getElementById('department').value = '';
    document.getElementById('designation').value = '';
    document.getElementById('address').value = '';
    document.getElementById('accNo').value = '';
    document.getElementById('mobileNo').value = '';
    document.getElementById('resPhone').value = '';
    document.getElementById('dateOfBirth').value = '';
    setDefaultDate();
    document.getElementById('resignDate').value = '';
    document.getElementById('gender').value = 'Male';
    document.getElementById('religion').value = 'Islam';
    document.getElementById('domicile').value = '';

    // Salary fields
    document.getElementById('basicSalary').value = '0';
    document.getElementById('tcAllowance').value = '0';
    document.getElementById('otherAllowance').value = '0';
    document.getElementById('areaAllowance').value = '0';
    document.getElementById('otherDeduction').value = '0';
    document.getElementById('bankCity').value = '';
    document.getElementById('securityDeposit').value = '0';

    // Other Information
    document.getElementById('areaCity').value = '';
    document.getElementById('ref1Name').value = '';
    document.getElementById('ref1Phone').value = '';
    document.getElementById('ref1Address').value = '';
    document.getElementById('ref2Name').value = '';
    document.getElementById('ref2Phone').value = '';
    document.getElementById('ref2Address').value = '';

    // Access Controls
    document.getElementById('allowOvertime').checked = false;
    document.getElementById('gtst').checked = false;
    document.getElementById('eobi').checked = false;
    document.getElementById('payProficiency').checked = false;
    document.getElementById('discountBill').checked = false;
    document.getElementById('threeWorkingDays').checked = false;
    document.getElementById('allowEmployeeAdvance').checked = false;
    document.getElementById('allowSalePerks').checked = false;
    document.getElementById('readOtherSalePerks').checked = false;
    document.getElementById('readOtherPerks').checked = false;
    document.getElementById('isActive').checked = true;

    // Bank Details
    document.getElementById('dbl').value = '';
    document.getElementById('alf').value = '';
    document.getElementById('hbf').value = '';
    document.getElementById('stf').value = '';
    document.getElementById('bank').value = '';
}

// Helper functions for + buttons
function addDepartment() {
    alert('Department creation modal will be implemented');
}

function addDesignation() {
    alert('Designation creation modal will be implemented');
}

function uploadPhoto() {
    alert('Photo upload functionality will be implemented');
}

