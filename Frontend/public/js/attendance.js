let attendanceRecords = [];
let employees = [];

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDates();
    loadEmployees();
    loadBranches();
    loadAttendanceList();

    // Calculate worked hours when check in/out changes
    document.getElementById('checkIn')?.addEventListener('change', calculateWorkedHours);
    document.getElementById('checkOut')?.addEventListener('change', calculateWorkedHours);
});

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fromDate').value = today;
    document.getElementById('toDate').value = today;
    document.getElementById('attendanceDate').value = today;
}

async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            employees = data.data.filter(emp => emp.isActive);
            const empSelect = document.getElementById('employee');
            empSelect.innerHTML = '<option value="">Select Employee</option>';
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp._id;
                option.textContent = `${emp.code} - ${emp.name}`;
                empSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

async function loadAttendanceList() {
    try {
        const token = localStorage.getItem('token');
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const branch = document.getElementById('filterBranch').value;

        let url = `/api/v1/attendance?from=${fromDate}&to=${toDate}`;
        if (branch) url += `&branch=${branch}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            attendanceRecords = data.data;
            renderAttendanceList();
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        alert('Error loading attendance records');
    }
}

function renderAttendanceList() {
    const tbody = document.getElementById('attendanceListBody');
    tbody.innerHTML = '';

    if (attendanceRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No attendance records found</td></tr>';
        return;
    }

    attendanceRecords.forEach(att => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(att.date).toLocaleDateString()}</td>
            <td>${att.employee?.name || '-'}</td>
            <td>${att.branch || '-'}</td>
            <td>${att.checkIn || '-'}</td>
            <td>${att.checkOut || '-'}</td>
            <td>${att.workedHrs || '-'}</td>
            <td><span class="badge bg-${getStatusColor(att.displayStatus)}">${att.displayStatus}</span></td>
            <td>${att.remarks || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editAttendance('${att._id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteAttendance('${att._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusColor(status) {
    switch (status) {
        case 'Present': return 'success';
        case 'Absent': return 'danger';
        case 'Leave': return 'warning';
        case 'Half Day': return 'info';
        default: return 'secondary';
    }
}

function calculateWorkedHours() {
    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;

    if (checkIn && checkOut) {
        const inTime = new Date(`2000-01-01 ${checkIn}`);
        const outTime = new Date(`2000-01-01 ${checkOut}`);
        const diff = (outTime - inTime) / 1000 / 60 / 60; // hours

        if (diff > 0) {
            const hours = Math.floor(diff);
            const minutes = Math.round((diff - hours) * 60);
            document.getElementById('workedHrs').value = `${hours}h ${minutes}m`;
        }
    }
}

async function saveAttendance() {
    const attendanceId = document.getElementById('attendanceId').value;
    const attendanceData = {
        employee: document.getElementById('employee').value,
        date: document.getElementById('attendanceDate').value,
        branch: document.getElementById('attendanceBranch').value,
        checkIn: document.getElementById('checkIn').value,
        checkOut: document.getElementById('checkOut').value,
        workedHrs: document.getElementById('workedHrs').value,
        breakHrs: document.getElementById('breakHrs').value,
        displayStatus: document.getElementById('displayStatus').value,
        remarks: document.getElementById('remarks').value,
        isPresent: document.getElementById('displayStatus').value === 'Present'
    };

    if (!attendanceData.employee || !attendanceData.date) {
        alert('Please select employee and date');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(attendanceData)
        });

        const data = await response.json();

        if (data.success) {
            alert('Attendance saved successfully');
            clearAttendanceForm();
            loadAttendanceList();
            // Switch to list tab
            const listTab = new bootstrap.Tab(document.querySelector('[href="#attendanceList"]'));
            listTab.show();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Error saving attendance');
    }
}

async function editAttendance(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/attendance/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const att = data.data;
            document.getElementById('attendanceId').value = att._id;
            document.getElementById('employee').value = att.employee?._id || '';
            document.getElementById('attendanceDate').value = att.date ? att.date.split('T')[0] : '';
            document.getElementById('attendanceBranch').value = att.branch || '';
            document.getElementById('checkIn').value = att.checkIn || '';
            document.getElementById('checkOut').value = att.checkOut || '';
            document.getElementById('workedHrs').value = att.workedHrs || '';
            document.getElementById('breakHrs').value = att.breakHrs || '0';
            document.getElementById('displayStatus').value = att.displayStatus || 'Present';
            document.getElementById('remarks').value = att.remarks || '';

            // Switch to add tab
            const addTab = new bootstrap.Tab(document.querySelector('[href="#attendanceAdd"]'));
            addTab.show();
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        alert('Error loading attendance');
    }
}

async function deleteAttendance(id) {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/attendance/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            alert('Attendance deleted successfully');
            loadAttendanceList();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting attendance:', error);
        alert('Error deleting attendance');
    }
}

function clearAttendanceForm() {
    document.getElementById('attendanceId').value = '';
    document.getElementById('employee').value = '';
    setDefaultDates();
    document.getElementById('attendanceBranch').value = '';
    document.getElementById('checkIn').value = '';
    document.getElementById('checkOut').value = '';
    document.getElementById('workedHrs').value = '';
    document.getElementById('breakHrs').value = '0';
    document.getElementById('displayStatus').value = 'Present';
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
            const filterSelect = document.getElementById('filterBranch');
            const formSelect = document.getElementById('attendanceBranch');

            // Populate filter select
            if (filterSelect) {
                const currentFilter = filterSelect.value;
                filterSelect.innerHTML = '<option value="">All</option>';
                data.data.forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.name;
                    option.textContent = store.name;
                    filterSelect.appendChild(option);
                });
                if (currentFilter) filterSelect.value = currentFilter;
            }

            // Populate form select
            if (formSelect) {
                const currentForm = formSelect.value;
                formSelect.innerHTML = '<option value="">Select Branch</option>';
                data.data.forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.name;
                    option.textContent = store.name;
                    formSelect.appendChild(option);
                });
                // Preserve selection if valid, or default if single branch
                if (currentForm && Array.from(formSelect.options).some(o => o.value === currentForm)) {
                    formSelect.value = currentForm;
                } else if (data.data.length === 1) {
                    formSelect.value = data.data[0].name;
                }
            }
        }
    } catch (e) {
        console.error('Error loading branches:', e);
    }
}
