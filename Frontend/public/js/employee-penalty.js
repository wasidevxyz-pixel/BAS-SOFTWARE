document.addEventListener('DOMContentLoaded', () => {
    loadBranches();
    loadEmployees();
    document.getElementById('date').valueAsDate = new Date();
    loadPenalties();

    document.getElementById('employee').addEventListener('change', autoFillEmployeeDetails);
    document.getElementById('date').addEventListener('change', loadPenalties);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            savePenalty();
        }
    });
});

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const branchSelect = document.getElementById('branch');
            branchSelect.innerHTML = '<option value="">Select Branch</option>';
            data.data.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store.name;
                opt.textContent = store.name;
                branchSelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error loading branches:', error);
    }
}

async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            window.allEmployees = data.data; // Cache for details
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

function autoFillEmployeeDetails() {
    const id = document.getElementById('employee').value;
    const emp = window.allEmployees.find(e => e._id === id);
    if (emp) {
        document.getElementById('code').value = emp.code || '';
        document.getElementById('department').value = emp.department?.name || emp.department || '';
        document.getElementById('designation').value = emp.designation?.name || emp.designation || '';
    } else {
        document.getElementById('code').value = '';
        document.getElementById('department').value = '';
        document.getElementById('designation').value = '';
    }
}

async function savePenalty() {
    const id = document.getElementById('penaltyId').value;
    const data = {
        date: document.getElementById('date').value,
        branch: document.getElementById('branch').value,
        employee: document.getElementById('employee').value,
        designation: document.getElementById('designation').value,
        penaltyAmount: document.getElementById('penaltyAmount').value
    };

    if (!data.employee || !data.penaltyAmount) {
        alert("Please fill required fields");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const url = id ? `/api/v1/employee-penalties/${id}` : '/api/v1/employee-penalties';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            alert(id ? 'Penalty updated!' : 'Penalty saved!');
            clearForm();
            loadPenalties();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving penalty:', error);
    }
}

async function loadPenalties() {
    try {
        const dateVal = document.getElementById('date').value;
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-penalties?date=${dateVal}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const list = document.getElementById('penaltyList');
        list.innerHTML = '';

        if (data.success) {
            window.allPenalties = data.data; // Cache for editing
            data.data.forEach(p => {
                const tr = document.createElement('tr');
                if (p.isPosted) {
                    tr.style.backgroundColor = '#e8f5e9'; // Light green highlight
                    tr.title = "This penalty is included in a saved payroll and cannot be modified.";
                }

                tr.innerHTML = `
                    <td>${new Date(p.date).toLocaleDateString()}</td>
                    <td>${p.employee?.code || 'N/A'}</td>
                    <td>${p.employee?.name || 'N/A'}</td>
                    <td>${p.department?.name || p.department || '-'}</td>
                    <td>${p.designation || '-'}</td>
                    <td>${p.penaltyAmount}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="editPenalty('${p._id}')" ${p.isPosted ? 'disabled' : ''}>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deletePenalty('${p._id}')" ${p.isPosted ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                list.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Error loading penalties', error);
    }
}

function editPenalty(id) {
    const penalty = window.allPenalties.find(p => p._id === id);
    if (penalty) {
        document.getElementById('penaltyId').value = penalty._id;
        document.getElementById('date').value = penalty.date.split('T')[0];
        document.getElementById('branch').value = penalty.branch;
        document.getElementById('employee').value = penalty.employee?._id || penalty.employee;

        // Trigger autofill for code, dept, desig
        autoFillEmployeeDetails();

        document.getElementById('penaltyAmount').value = penalty.penaltyAmount;
    }
}

function clearForm() {
    document.getElementById('penaltyId').value = '';
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('branch').value = '';
    document.getElementById('employee').value = '';
    document.getElementById('code').value = '';
    document.getElementById('department').value = '';
    document.getElementById('designation').value = '';
    document.getElementById('penaltyAmount').value = '';
}

async function deletePenalty(id) {
    if (!confirm('Are you sure?')) return;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/employee-penalties/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) loadPenalties();
    } catch (err) { console.error(err); }
}

function searchPenalties() {
    const filter = document.getElementById('search').value.toUpperCase();
    const rows = document.getElementById('penaltyList').getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent || rows[i].innerText;
        if (text.toUpperCase().indexOf(filter) > -1) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}
