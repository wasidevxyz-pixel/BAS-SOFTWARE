document.addEventListener('DOMContentLoaded', () => {
    loadBranches();
    loadEmployees();
    setDefaults();
    loadAdjustments();

    document.getElementById('employee').addEventListener('change', autoFillDetails);
});

function setDefaults() {
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('searchFrom').valueAsDate = new Date();
    document.getElementById('searchTo').valueAsDate = new Date();
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

function autoFillDetails() {
    const id = document.getElementById('employee').value;
    const emp = window.allEmployees.find(e => e._id === id);
    if (emp) {
        document.getElementById('code').value = emp.code || '';
        // Mock PreBal
        document.getElementById('preBal').value = 0;
    }
    calculateBalance();
}

document.getElementById('paid').addEventListener('input', calculateBalance);

function calculateBalance() {
    const preBal = parseFloat(document.getElementById('preBal').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    document.getElementById('balance').value = preBal - paid;
}

async function saveAdjustment() {
    const data = {
        type: document.getElementById('adjType').value,
        date: document.getElementById('date').value,
        branch: document.getElementById('branch').value,
        employee: document.getElementById('employee').value,
        preBal: parseFloat(document.getElementById('preBal').value) || 0,
        amount: parseFloat(document.getElementById('paid').value) || 0,
        balance: parseFloat(document.getElementById('balance').value) || 0,
        remarks: document.getElementById('remarks').value
    };

    if (!data.employee || !data.amount) {
        alert("Please fill required fields");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-adjustments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            alert("Adjustment Saved");
            loadAdjustments();
        } else {
            alert("Error: " + result.message);
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadAdjustments() {
    try {
        const token = localStorage.getItem('token');
        // Simple fetch all or search by date
        const response = await fetch('/api/v1/employee-adjustments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const list = document.getElementById('adjustmentList');
        list.innerHTML = '';

        if (data.success) {
            data.data.forEach(adj => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(adj.date).toLocaleDateString()}</td>
                    <td>${adj.employee?.name || '--'}</td>
                    <td>${adj.type}</td>
                    <td>${adj.amount}</td>
                    <td>${adj.remarks || ''}</td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteAdjustment('${adj._id}')">X</button></td>
                `;
                list.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteAdjustment(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-adjustments/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) loadAdjustments();
    } catch (err) { console.error(err); }
}

function clearForm() {
    document.querySelectorAll('input').forEach(i => i.value = '');
    setDefaults();
}
