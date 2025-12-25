document.addEventListener('DOMContentLoaded', () => {
    loadBranches();
    loadEmployees();
    loadPenalties();
    document.getElementById('date').valueAsDate = new Date();

    document.getElementById('employee').addEventListener('change', autoFillEmployeeDetails);
});

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
        document.getElementById('designation').value = emp.designation || '';
    } else {
        document.getElementById('code').value = '';
        document.getElementById('department').value = '';
        document.getElementById('designation').value = '';
    }
}

async function savePenalty() {
    const data = {
        date: document.getElementById('date').value,
        branch: document.getElementById('branch').value,
        employee: document.getElementById('employee').value,
        department: document.getElementById('department').value, // Assuming storing name, or lookup ID if needed
        designation: document.getElementById('designation').value,
        penaltyAmount: document.getElementById('penaltyAmount').value
    };

    if (!data.employee || !data.penaltyAmount) {
        alert("Please fill required fields");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-penalties', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            alert('Penalty saved!');
            document.getElementById('penaltyAmount').value = '';
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
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-penalties', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const list = document.getElementById('penaltyList');
        list.innerHTML = '';

        if (data.success) {
            data.data.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(p.date).toLocaleDateString()}</td>
                    <td>${p.employee?.code || 'N/A'}</td>
                    <td>${p.employee?.name || 'N/A'}</td>
                    <td>${p.department?.name || p.department || '-'}</td>
                    <td>${p.designation || '-'}</td>
                    <td>${p.penaltyAmount}</td>
                    <td><button class="btn btn-danger btn-sm" onclick="deletePenalty('${p._id}')"><i class="fas fa-trash"></i></button></td>
                `;
                list.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Error loading penalties', error);
    }
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
    // ToDo: Implement specific search filter
    loadPenalties();
}
