let advances = [];
let employees = [];

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDate();
    loadEmployees();
    loadBranches();
    loadAdvances();

    // Search functionality
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = advances.filter(adv =>
            adv.employee?.name?.toLowerCase().includes(searchTerm) ||
            adv.branch?.toLowerCase().includes(searchTerm)
        );
        renderTable(filtered);
    });
});

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            employees = data.data.filter(emp => emp.isActive && emp.allowEmployeeAdvance);
            const empSelect = document.getElementById('employee');
            empSelect.innerHTML = '<option value="">Select Employee</option>';
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp._id;
                option.textContent = `${emp.code} - ${emp.name}`;
                option.dataset.code = emp.code;
                option.dataset.salary = emp.basicSalary || 0;
                empSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

async function loadEmployeeBalance() {
    const empSelect = document.getElementById('employee');
    const selectedOption = empSelect.options[empSelect.selectedIndex];

    if (selectedOption.value) {
        document.getElementById('code').value = selectedOption.dataset.code || '';
        document.getElementById('salary').value = selectedOption.dataset.salary || 0;

        // Load previous balance
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/v1/employee-advances?employee=${selectedOption.value}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                const lastAdvance = data.data[0];
                document.getElementById('preMonthBal').value = lastAdvance.balance || 0;
            } else {
                document.getElementById('preMonthBal').value = 0;
            }

            calculateTotals();
        } catch (error) {
            console.error('Error loading balance:', error);
        }
    } else {
        document.getElementById('code').value = '';
        document.getElementById('salary').value = 0;
        document.getElementById('preMonthBal').value = 0;
    }
}

function calculateTotals() {
    const preMonthBal = parseFloat(document.getElementById('preMonthBal').value) || 0;
    const currentMonthBal = parseFloat(document.getElementById('currentMonthBal').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;

    const total = preMonthBal + currentMonthBal;
    const balance = total - paid;

    document.getElementById('total').value = total;
    document.getElementById('balance').value = balance;
}

async function loadAdvances() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-advances', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            advances = data.data;
            renderTable(advances);
        }
    } catch (error) {
        console.error('Error loading advances:', error);
        alert('Error loading advances');
    }
}

function renderTable(data) {
    const tbody = document.getElementById('advanceBody');
    tbody.innerHTML = '';

    data.forEach(adv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(adv.date).toLocaleDateString()}</td>
            <td>${adv.employee?.name || '-'}</td>
            <td>${adv.branch || '-'}</td>
            <td>${adv.total || 0}</td>
            <td>${adv.paid || 0}</td>
            <td>${adv.balance || 0}</td>
            <td>${adv.docMode || 'Cash'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editAdvance('${adv._id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteAdvance('${adv._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveAdvance() {
    const advanceId = document.getElementById('advanceId').value;
    const advanceData = {
        employee: document.getElementById('employee').value,
        date: document.getElementById('date').value,
        branch: document.getElementById('branch').value,
        code: document.getElementById('code').value,
        preMonthBal: parseFloat(document.getElementById('preMonthBal').value) || 0,
        currentMonthBal: parseFloat(document.getElementById('currentMonthBal').value) || 0,
        total: parseFloat(document.getElementById('total').value) || 0,
        salary: parseFloat(document.getElementById('salary').value) || 0,
        paid: parseFloat(document.getElementById('paid').value) || 0,
        balance: parseFloat(document.getElementById('balance').value) || 0,
        docMode: document.getElementById('docMode').value,
        remarks: document.getElementById('remarks').value
    };

    if (!advanceData.employee || !advanceData.date) {
        alert('Please select employee and date');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const url = advanceId ? `/api/v1/employee-advances/${advanceId}` : '/api/v1/employee-advances';
        const method = advanceId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(advanceData)
        });

        const data = await response.json();

        if (data.success) {
            alert(advanceId ? 'Advance updated successfully' : 'Advance created successfully');
            clearForm();
            loadAdvances();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error saving advance:', error);
        alert('Error saving advance');
    }
}

async function editAdvance(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-advances/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const adv = data.data;
            document.getElementById('advanceId').value = adv._id;
            document.getElementById('employee').value = adv.employee?._id || '';
            document.getElementById('date').value = adv.date ? adv.date.split('T')[0] : '';
            document.getElementById('branch').value = adv.branch || '';
            document.getElementById('code').value = adv.code || '';
            document.getElementById('preMonthBal').value = adv.preMonthBal || 0;
            document.getElementById('currentMonthBal').value = adv.currentMonthBal || 0;
            document.getElementById('total').value = adv.total || 0;
            document.getElementById('salary').value = adv.salary || 0;
            document.getElementById('paid').value = adv.paid || 0;
            document.getElementById('balance').value = adv.balance || 0;
            document.getElementById('docMode').value = adv.docMode || 'Cash';
            document.getElementById('remarks').value = adv.remarks || '';
        }
    } catch (error) {
        console.error('Error loading advance:', error);
        alert('Error loading advance');
    }
}

async function deleteAdvance(id) {
    if (!confirm('Are you sure you want to delete this advance?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-advances/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            alert('Advance deleted successfully');
            loadAdvances();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting advance:', error);
        alert('Error deleting advance');
    }
}

function clearForm() {
    document.getElementById('advanceId').value = '';
    document.getElementById('employee').value = '';
    setDefaultDate();
    document.getElementById('branch').value = '';
    document.getElementById('code').value = '';
    document.getElementById('preMonthBal').value = '0';
    document.getElementById('currentMonthBal').value = '0';
    document.getElementById('total').value = '0';
    document.getElementById('salary').value = '0';
    document.getElementById('paid').value = '0';
    document.getElementById('balance').value = '0';
    document.getElementById('docMode').value = 'Cash';
    document.getElementById('remarks').value = '';
}

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('branch');
            select.innerHTML = '<option value="">Select Branch</option>';
            data.data.forEach(store => {
                const option = document.createElement('option');
                option.value = store.name;
                option.textContent = store.name;
                select.appendChild(option);
            });
            if (data.data.length === 1) {
                select.value = data.data[0].name;
            }
        }
    } catch (e) {
        console.error('Error loading branches:', e);
    }
}
