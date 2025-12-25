document.addEventListener('DOMContentLoaded', () => {
    loadBranches();
    loadEmployees();
    setDefaults();

    document.getElementById('employee').addEventListener('change', loadEmployeeDetails);
});

function setDefaults() {
    document.getElementById('date').valueAsDate = new Date();
}

async function loadBranches() {
    const branchSelect = document.getElementById('branch');
    const branches = ['F-6', 'G-10', 'I-8'];
    branchSelect.innerHTML = '<option value="">Select Branch</option>';
    branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        branchSelect.appendChild(opt);
    });
}

async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            window.allEmployees = data.data;
            const select = document.getElementById('employee');
            data.data.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp._id;
                opt.textContent = emp.name;
                select.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error loading employees', error);
    }
}

async function loadEmployeeDetails() {
    const id = document.getElementById('employee').value;
    if (!id) return;

    const emp = window.allEmployees.find(e => e._id === id);
    if (emp) {
        document.getElementById('code').value = emp.code || '';
        document.getElementById('contact').value = emp.phone || emp.mobile || '';
        document.getElementById('department').value = emp.department?.name || emp.department || '';
        document.getElementById('designation').value = emp.designation || '';
        document.getElementById('basicSalary').value = emp.basicSalary || emp.salary || 0;

        // Try to find the latest payroll
        await findLatestPayroll(id);
    }
}

async function findLatestPayroll(employeeId) {
    // Only fetching based on ID for now, maybe need month?
    // Let's just create a blank row for manual entry if can't find specific API
    // Or we could try fetching payrolls list
    // This is a "Clearance" Form, implies Final Settlement.

    // For now, I'll mock/setup the grid
    const tbody = document.getElementById('payrollDetails');
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control form-control-sm" placeholder="Auto/Man"></td>
        <td><input type="text" class="form-control form-control-sm" value="Current"></td>
        <td><input type="text" class="form-control form-control-sm" value="${new Date().getFullYear()}"></td>
        <td><input type="number" class="form-control form-control-sm" id="rowGross"></td>
        <td><input type="number" class="form-control form-control-sm" id="rowPaid"></td>
        <td><input type="number" class="form-control form-control-sm" id="rowDeduct"></td>
        <td><input type="text" class="form-control form-control-sm"></td>
    `;
    tbody.appendChild(tr);

    // Listeners for auto-sum
    ['rowGross', 'rowPaid', 'rowDeduct'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateTotals);
    });
}

function updateTotals() {
    const gross = parseFloat(document.getElementById('rowGross').value) || 0;
    const paid = parseFloat(document.getElementById('rowPaid').value) || 0;
    const ded = parseFloat(document.getElementById('rowDeduct').value) || 0;

    document.getElementById('totalGross').value = gross;
    document.getElementById('totalPaid').value = paid;
    document.getElementById('totalDeduction').value = ded;

    // PreBalance? Advance? Manual inputs
    // Net Pay calculation logic if needed
}

async function saveClearance() {
    const data = {
        branch: document.getElementById('branch').value,
        employee: document.getElementById('employee').value,
        date: document.getElementById('date').value,
        remarks: document.getElementById('remarks').value,

        grossSalary: parseFloat(document.getElementById('totalGross').value) || 0,
        paid: parseFloat(document.getElementById('totalPaid').value) || 0,
        deduction: parseFloat(document.getElementById('totalDeduction').value) || 0,
        advance: parseFloat(document.getElementById('advance').value) || 0,
        preBalance: parseFloat(document.getElementById('preBalance').value) || 0
    };

    if (!data.employee) { alert("Select Employee"); return; }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-clearances', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            alert("Clearance Saved");
            clearForm();
        } else {
            alert("Error: " + result.message);
        }
    } catch (err) {
        console.error(err);
    }
}

function clearForm() {
    document.querySelectorAll('input').forEach(i => i.value = '');
    document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    setDefaults();
}

function showList() {
    // Show modal with list
    alert("List logic to be implemented");
}
