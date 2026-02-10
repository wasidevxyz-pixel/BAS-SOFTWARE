let attendanceRecords = [];
let branches = [];
let departments = [];
let designations = [];

document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDates();
    await Promise.all([
        loadBranches(),
        loadDepartments(),
        loadDesignations(),
    ]);
    await loadAttendanceList();

    // Auto-refresh every 5 seconds (5000ms)
    setInterval(() => loadAttendanceList(true), 5000);
});

function setDefaultDates() {
    const now = new Date();
    const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    document.getElementById('fromDate').value = today;
    document.getElementById('toDate').value = today;
}

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('filterBranch');
            select.innerHTML = '<option value="">All Branches</option>';
            data.data.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.name;
                select.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function loadDepartments() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employee-departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('filterDept');
            select.innerHTML = '<option value="">Select Department</option>';
            data.data.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.textContent = d.name;
                select.appendChild(opt);
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
            const select = document.getElementById('filterDesig');
            select.innerHTML = '<option value="">Select Designation</option>';
            data.data.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.textContent = d.name;
                select.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function loadAttendanceList(isBackground = false) {
    // Skip background refresh if user is interacting with inputs
    if (isBackground && document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
        return;
    }

    const tbody = document.getElementById('attendanceRecordsBody');
    if (!isBackground) {
        tbody.innerHTML = '<tr><td colspan="19" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
    }

    try {
        const token = localStorage.getItem('token');
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const branch = document.getElementById('filterBranch').value;
        const dept = document.getElementById('filterDept').value;
        const desig = document.getElementById('filterDesig').value;
        const status = document.getElementById('filterStatus').value;

        // Update Screen Grid Header
        if (document.getElementById('dispDateRange')) {
            document.getElementById('dispDateRange').textContent = `${fromDate} to ${toDate}`;
        }
        if (document.getElementById('dispDept')) {
            const deptText = document.getElementById('filterDept').options[document.getElementById('filterDept').selectedIndex].text;
            document.getElementById('dispDept').textContent = dept ? deptText : 'All Departments';
        }

        // 1. Fetch Employees
        const empRes = await fetch(`/api/v1/employees?branch=${branch}&department=${dept}&designation=${desig}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const empData = await empRes.json();

        // 2. Fetch Attendance
        let attUrl = `/api/v1/attendance?from=${fromDate}&to=${toDate}&branch=${branch}`;
        const attRes = await fetch(attUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const attData = await attRes.json();

        if (empData.success && attData.success) {
            const allEmployees = empData.data.filter(e => e.isActive);
            const recordedAttendance = attData.data;

            // Merge: For each employee, see if they have a record for this date
            // If it's a single date, we match easily. If range, it's more complex, but usually registers are single-date.
            attendanceRecords = allEmployees.map(emp => {
                const record = recordedAttendance.find(a =>
                    a.employee && (a.employee._id === emp._id || a.employee === emp._id)
                );

                if (record) return record;

                // Return a "virtual" record if none exists
                return {
                    _id: `new_${emp._id}`,
                    employee: emp,
                    date: fromDate,
                    branch: emp.branch,
                    displayStatus: 'Present',
                    checkIn: '',
                    checkOut: '',
                    workedHrs: '',
                    isNew: true
                };
            });

            // Status filter (client-side for merged data)
            if (status) {
                if (status === 'less_1hr') {
                    attendanceRecords = attendanceRecords.filter(r => {
                        const mins = parseTime(r.workedHrs);
                        return mins > 0 && mins < 60;
                    });
                } else if (status === 'greater_17hr') {
                    attendanceRecords = attendanceRecords.filter(r => {
                        const mins = parseTime(r.workedHrs);
                        return mins > 1020; // 17 * 60
                    });
                } else if (status === 'no_checkinout') {
                    attendanceRecords = attendanceRecords.filter(r => !r.checkIn && !r.checkOut);
                } else if (status === 'checkin_no_out') {
                    attendanceRecords = attendanceRecords.filter(r => r.checkIn && !r.checkOut);
                } else {
                    attendanceRecords = attendanceRecords.filter(r => r.displayStatus === status);
                }
            }

            // Preserve scroll position during refresh
            const tableContainer = document.querySelector('.table-container');
            const scrollTop = tableContainer ? tableContainer.scrollTop : 0;
            const scrollLeft = tableContainer ? tableContainer.scrollLeft : 0;

            renderAttendanceTable();

            if (isBackground && tableContainer) {
                tableContainer.scrollTop = scrollTop;
                tableContainer.scrollLeft = scrollLeft;
            }
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        tbody.innerHTML = '<tr><td colspan="19" class="text-center text-danger">Error loading data</td></tr>';
    }
}

function renderAttendanceTable() {
    const tbody = document.getElementById('attendanceRecordsBody');
    tbody.innerHTML = '';

    attendanceRecords.forEach((att, index) => {
        const tr = document.createElement('tr');

        // Calculate mins for initial coloring
        const mins = att.totalHrs ? (att.totalHrs * 60) : parseTime(att.workedHrs);

        // Initial color based on activity
        tr.className = '';
        if (att.displayStatus === 'Absent') {
            tr.className = 'row-absent';
        } else if (att.displayStatus === 'Leave') {
            tr.className = 'row-leave';
        } else if (mins >= 1020) {
            tr.className = 'row-overtime';
        } else if (mins > 0 && mins <= 60) {
            tr.className = 'row-warning';
        } else if (att.checkIn && att.checkOut) {
            tr.className = 'row-completed';
        } else if (att.checkIn) {
            tr.className = 'row-partial';
        }

        tr.dataset.id = att._id;

        const date = new Date(att.date);
        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td class="text-center col-sr">${index + 1}</td>
            <td class="text-center col-date" style="font-weight: 600;">${dateStr}</td>
            <td class="text-center col-code">
                <div class="d-flex align-items-center justify-content-center gap-1">
                    <a href="/employee-attendance-detail.html?id=${att.employee?._id || ''}&date=${att.date}" class="code-link-box">
                        ${att.employee?.code || '-'}
                    </a>
                    <button class="btn btn-primary btn-xs py-0 px-1" style="font-size: 0.65rem;" onclick="quickSaveAttendance('${att._id}', this)">Save</button>
                    <span class="print-value">${att.employee?.code || '-'}</span>
                </div>
            </td>
            <td class="ps-2 fw-bold text-uppercase col-name">
                ${att.employee?.name || '-'}
                <span class="badge rounded-circle ms-1 px-2 py-1 ${att.displayStatus === 'Absent' ? 'bg-danger text-white' : 'bg-white text-danger border border-danger'}" 
                      style="font-size: 0.6rem; cursor: pointer;" 
                      onclick="toggleAbsent(this)"
                      title="Toggle Absent/Present">A</span>
            </td>
            <td class="text-center col-dept">${att.employee?.department?.name || '-'}</td>
            <td class="text-center col-desig">${att.employee?.designation?.name || '-'}</td>
            <td class="text-center col-duty" style="font-weight: 600;">${getDutyHoursDisplay(att.employee)}</td>
            <td class="px-1 col-checkin">
                <input type="time" class="form-control form-control-xs text-center fw-bold" value="${convertTo24Hour(att.checkIn)}" oninput="updateWorkedHrs(this)">
                <span class="print-value">${att.checkIn || ''}</span>
            </td>
            <td class="px-1 col-checkout">
                <input type="time" class="form-control form-control-xs text-center fw-bold" value="${convertTo24Hour(att.checkOut)}" oninput="updateWorkedHrs(this)">
                <span class="print-value">${att.checkOut || ''}</span>
            </td>
            <td class="text-center fw-bold col-worked">${att.workedHrs || ''}</td>
            <td class="px-1 col-breakout">
                <input type="time" class="form-control form-control-xs text-center" value="${convertTo24Hour(att.breakOut)}" oninput="updateWorkedHrs(this)">
                <span class="print-value">${att.breakOut || ''}</span>
            </td>
            <td class="px-1 col-breakin">
                <input type="time" class="form-control form-control-xs text-center" value="${convertTo24Hour(att.breakIn)}" oninput="updateWorkedHrs(this)">
                <span class="print-value">${att.breakIn || ''}</span>
            </td>
            <td class="text-center col-breakhrs">${att.breakHrs || ''}</td>
            <td class="px-0 col-diff">
                <div class="diff-btns" data-mode="${att.diffMode || '+'}">
                    <button class="btn btn-diff btn-success ${(!att.diffMode || att.diffMode === '+') ? '' : 'opacity-50'}" onclick="setDiffMode(this, '+')">+</button>
                    <button class="btn btn-diff btn-danger ${att.diffMode === '-' ? '' : 'opacity-50'}" onclick="setDiffMode(this, '-')">-</button>
                </div>
            </td>
            <td class="px-1 col-diffin"><input type="time" class="input-diff-box" value="${convertTo24Hour(att.timeDiffIn)}" oninput="updateWorkedHrs(this)"></td>
            <td class="px-1 col-diffout"><input type="time" class="input-diff-box" value="${convertTo24Hour(att.timeDiffOut)}" oninput="updateWorkedHrs(this)"></td>
            <td class="text-center fw-bold text-primary col-totaldiff">${att.totalDiffHrs || ''}</td>
            <td class="text-center fw-bold col-totalhrs">${att.totalHrs ? (Math.floor(att.totalHrs) + ':' + Math.round((att.totalHrs % 1) * 60).toString().padStart(2, '0')) : (att.workedHrs || '')}</td>
            <td class="px-1 text-center col-status">
                <select class="form-select form-select-xs fw-bold" onchange="if(this.value === 'Absent' && !confirm('ARE YOU SURE YOU WANT TO MARK AS ABSENT?')) { this.value = 'Present'; return; } updateRowColor(this); quickSaveAttendance(this.closest('tr').dataset.id, this.closest('tr').querySelector('.btn-primary, .btn-success'))">
                    <option value="Present" ${att.displayStatus === 'Present' ? 'selected' : ''}>Present</option>
                    <option value="Absent" ${att.displayStatus === 'Absent' ? 'selected' : ''}>Absent</option>
                </select>
                <span class="print-value">${att.displayStatus ? att.displayStatus.charAt(0) : ''}</span>
            </td>
        `;
        tbody.appendChild(tr);
        // Trigger calculation for each row to populate Worked Hrs and set color
        const checkInInput = tr.querySelector('.col-checkin input');
        if (checkInInput) updateWorkedHrs(checkInInput);
    });
}

function updateRowColor(element) {
    const tr = element.closest('tr');
    const statusSelect = tr.querySelector('.col-status select');
    const checkInInput = tr.querySelector('.col-checkin input');
    const checkOutInput = tr.querySelector('.col-checkout input');
    const totalHrsText = tr.querySelector('.col-totalhrs').textContent;

    if (!statusSelect || !checkInInput) return;

    const status = statusSelect.value;
    const checkIn = checkInInput.value;
    const checkOut = checkOutInput ? checkOutInput.value : '';
    const mins = parseTime(totalHrsText);

    // CLEAR DATA IF ABSENT OR LEAVE
    if (status === 'Absent' || status === 'Leave') {
        const inputs = tr.querySelectorAll('input[type="time"]');
        inputs.forEach(input => input.value = '');

        tr.querySelector('.col-worked').textContent = '';
        tr.querySelector('.col-breakhrs').textContent = '';
        tr.querySelector('.col-totaldiff').textContent = '';
        tr.querySelector('.col-totalhrs').textContent = '';

        // Update print values
        tr.querySelectorAll('.print-value').forEach(span => {
            // Skip the code/name print values, only clear time/calc ones
            // Actually, safest is just to let the inputs clear them? No, print values are separate spans.
            // Let's just specific ones if we can, or iterate.
            // The spans are next to inputs.
            if (span.previousElementSibling && span.previousElementSibling.tagName === 'INPUT') {
                span.textContent = '';
            }
        });
    }

    tr.className = '';
    if (status === 'Absent') {
        tr.className = 'row-absent';
    } else if (status === 'Leave') {
        tr.className = 'row-leave';
    } else if (mins >= 1020) {
        tr.className = 'row-overtime';
    } else if (mins > 0 && mins <= 60) {
        tr.className = 'row-warning';
    } else if (checkIn && checkOut) {
        tr.className = 'row-completed';
    } else if (checkIn) {
        tr.className = 'row-partial';
    }

    // Dynamic Name Badge Update
    const nameCell = tr.querySelector('.col-name');
    if (nameCell) {
        let badge = nameCell.querySelector('.badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge rounded-circle ms-1 px-2 py-1';
            badge.style.fontSize = '0.6rem';
            badge.style.cursor = 'pointer';
            badge.textContent = 'A';
            badge.onclick = function () { toggleAbsent(this); };
            badge.title = "Toggle Absent/Present";
            nameCell.appendChild(badge);
        }

        if (status === 'Absent') {
            badge.className = 'badge rounded-circle ms-1 px-2 py-1 bg-danger text-white';
        } else {
            badge.className = 'badge rounded-circle ms-1 px-2 py-1 bg-white text-danger border border-danger';
        }
    }
}

function toggleAbsent(badge) {
    const tr = badge.closest('tr');
    const statusSelect = tr.querySelector('.col-status select');
    if (!statusSelect) return;

    if (statusSelect.value === 'Absent') {
        statusSelect.value = 'Present'; // Toggle back to Present
    } else {
        // ASK FOR CONFIRMATION BEFORE MARKING ABSENT
        const employeeName = tr.querySelector('.col-name').childNodes[0].textContent.trim();
        if (!confirm(`ARE YOU SURE YOU WANT TO MARK "${employeeName}" AS ABSENT?`)) {
            return; // Abort if user clicks No/Cancel
        }
        statusSelect.value = 'Absent'; // Set to Absent
    }

    // Trigger update logic
    updateRowColor(statusSelect);

    // AUTO SAVE
    const saveBtn = tr.querySelector('.btn-primary, .btn-success');
    if (saveBtn) {
        const id = tr.dataset.id;
        quickSaveAttendance(id, saveBtn);
    }
}

function setDiffMode(btn, mode) {
    const parent = btn.closest('.diff-btns');
    parent.dataset.mode = mode;
    parent.querySelectorAll('.btn-diff').forEach(b => b.classList.add('opacity-50'));
    btn.classList.remove('opacity-50');
    updateWorkedHrs(btn);
}

function handleGlobalSearch(value) {
    const filter = value.toUpperCase();
    const rows = document.getElementById('attendanceRecordsBody').getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent || rows[i].innerText;
        if (text.toUpperCase().indexOf(filter) > -1) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}

function updateWorkedHrs(input) {
    const tr = input.closest('tr');
    const checkIn = tr.querySelector('.col-checkin input').value;
    const checkOut = tr.querySelector('.col-checkout input').value;
    const breakOut = tr.querySelector('.col-breakout input').value;
    const breakIn = tr.querySelector('.col-breakin input').value;
    const diffIn = tr.querySelector('.col-diffin input').value;
    const diffOut = tr.querySelector('.col-diffout input').value;
    const mode = tr.querySelector('.diff-btns').dataset.mode || '+';

    // Update Print Values for Inputs
    tr.querySelectorAll('input').forEach(inp => {
        const span = inp.nextElementSibling;
        if (span && span.classList.contains('print-value')) span.textContent = inp.value;
    });
    // Update Print Values for Selects
    tr.querySelectorAll('select').forEach(sel => {
        const span = sel.nextElementSibling;
        if (span && span.classList.contains('print-value')) span.textContent = sel.value ? sel.value.charAt(0) : '';
    });

    // 1. Calculate Break Hrs
    let bMin = 0;
    if (breakOut && breakIn) {
        const outParts = breakOut.split(':').map(Number);
        const inParts = breakIn.split(':').map(Number);
        bMin = (inParts[0] * 60 + inParts[1]) - (outParts[0] * 60 + outParts[1]);
        if (bMin < 0) bMin += 1440; // overnight

        const bHrsStr = `${Math.floor(bMin / 60)}:${(bMin % 60).toString().padStart(2, '0')}`;
        tr.querySelector('.col-breakhrs').textContent = bHrsStr;
    } else {
        tr.querySelector('.col-breakhrs').textContent = '';
    }

    // 2. Calculate Total Diffs (Duration between Diff In and Diff Out)
    let totalDiffMin = 0;
    if (diffIn && diffOut) {
        const inParts = diffIn.split(':').map(Number);
        const outParts = diffOut.split(':').map(Number);
        totalDiffMin = (outParts[0] * 60 + outParts[1]) - (inParts[0] * 60 + inParts[1]);
        if (totalDiffMin < 0) totalDiffMin += 1440;

        const totalDiffStr = `${Math.floor(totalDiffMin / 60)}:${(totalDiffMin % 60).toString().padStart(2, '0')}`;
        tr.querySelector('.col-totaldiff').textContent = totalDiffStr;
    } else {
        tr.querySelector('.col-totaldiff').textContent = '';
    }

    // 3. Gross Worked (Check-In to Check-Out)
    if (checkIn && checkOut) {
        const cin = checkIn.split(':').map(Number);
        const cout = checkOut.split(':').map(Number);
        let wMin = (cout[0] * 60 + cout[1]) - (cin[0] * 60 + cin[1]);
        if (wMin < 0) wMin += 1440;

        const grossHrsStr = `${Math.floor(wMin / 60)}:${(wMin % 60).toString().padStart(2, '0')}`;
        tr.querySelector('.col-worked').textContent = grossHrsStr;

        // 4. Net Worked (Gross - Break)
        let netMin = wMin - (bMin || 0);
        if (netMin < 0) netMin = 0;

        // 5. Final Total (Net +/- Diff)
        let finalMin = netMin;
        if (mode === '+') finalMin += (totalDiffMin || 0);
        else finalMin -= (totalDiffMin || 0);
        if (finalMin < 0) finalMin = 0;

        const h = Math.floor(finalMin / 60);
        const m = finalMin % 60;
        const finalStr = `${h}:${m.toString().padStart(2, '0')}`;

        tr.querySelector('.col-totalhrs').textContent = finalStr;

        // Auto-set status if both times filled
        const statusSelect = tr.querySelector('.col-status select');
        if (statusSelect.value === 'Absent' || statusSelect.value === '') {
            statusSelect.value = 'Present';
            // Also update print value for status
            const span = statusSelect.nextElementSibling;
            if (span && span.classList.contains('print-value')) span.textContent = 'P';
            updateRowColor(statusSelect);
        }
    } else {
        // Only show Worked Hrs if BOTH CheckIn and CheckOut are present
        tr.querySelector('.col-worked').textContent = '';
        tr.querySelector('.col-totalhrs').textContent = '';
    }
    updateRowColor(input);
}

async function quickSaveAttendance(id, btn) {
    const tr = btn.closest('tr');
    const isNew = id.startsWith('new_');
    const realEmpId = isNew ? id.replace('new_', '') : null;

    // Find matching record from local array to get accurate date
    const localRecord = attendanceRecords.find(r => r._id === id);

    const updatedData = {
        employee: realEmpId || (localRecord.employee?._id || localRecord.employee),
        date: localRecord.date,
        branch: localRecord.branch || (document.getElementById('filterBranch').value || '(PWD-1)'),
        branch: localRecord.branch || (document.getElementById('filterBranch').value || '(PWD-1)'),
        checkIn: tr.querySelector('.col-checkin input').value,
        checkOut: tr.querySelector('.col-checkout input').value,
        workedHrs: tr.querySelector('.col-worked').textContent,
        breakOut: tr.querySelector('.col-breakout input').value,
        breakIn: tr.querySelector('.col-breakin input').value,
        breakHrs: tr.querySelector('.col-breakhrs').textContent,
        diffMode: tr.querySelector('.diff-btns').dataset.mode || '+',
        timeDiffIn: tr.querySelector('.col-diffin input').value,
        timeDiffOut: tr.querySelector('.col-diffout input').value,
        totalDiffHrs: tr.querySelector('.col-totaldiff').textContent,
        totalHrs: (() => {
            const str = tr.querySelector('.col-totalhrs').textContent;
            if (!str || !str.includes(':')) return 0;
            const [h, m] = str.split(':').map(Number);
            return (h || 0) + ((m || 0) / 60);
        })(),
        displayStatus: tr.querySelector('.col-status select').value,
        isPresent: tr.querySelector('.col-status select').value === 'Present'
    };

    // Prevent saving if hours are negative (common mistake)
    if (updatedData.workedHrs && updatedData.workedHrs.startsWith('-')) {
        alert('Negative Worked Hours are not allowed. Please check IN/OUT times.');
        return;
    }
    if (updatedData.breakHrs && updatedData.breakHrs.startsWith('-')) {
        alert('Negative Break Hours are not allowed. Please check Break OUT/IN times.');
        return;
    }
    if (updatedData.totalDiffHrs && updatedData.totalDiffHrs.startsWith('-')) {
        alert('Negative Total Difference is not allowed. Please check Diff times.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const method = isNew ? 'POST' : 'PUT';
        const url = isNew ? '/api/v1/attendance' : `/api/v1/attendance/${id}`;

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedData)
        });

        const data = await res.json();
        if (data.success) {
            btn.textContent = 'Saved!';
            btn.classList.replace('btn-primary', 'btn-success');

            // If it was new, we should reload to get the real ID from DB
            if (isNew) await loadAttendanceList();
            else updateRowColor(tr); // Immediate color update for existing rows

            setTimeout(() => {
                btn.textContent = 'Save';
                btn.classList.replace('btn-success', 'btn-primary');
            }, 2000);
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Failed to update attendance');
    }
}
function handlePrint() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const branch = document.getElementById('filterBranch').options[document.getElementById('filterBranch').selectedIndex]?.text || '';

    // Update the new Simple Header elements
    if (document.getElementById('pDateRange')) {
        document.getElementById('pDateRange').textContent = `${fromDate} to ${toDate}`;
    }

    if (document.getElementById('pBranchHeader')) {
        document.getElementById('pBranchHeader').textContent = `Branch: ${branch}`;
    }

    window.print();
}


function convertTo24Hour(timeStr) {
    if (!timeStr) return '';
    if (timeStr.includes(':') && (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm'))) {
        let [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier.toLowerCase() === 'pm') hours = parseInt(hours, 10) + 12;
        return `${hours.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    }
    return timeStr; // Return as is if already 24h or invalid
}

function parseTime(timeStr) {
    if (!timeStr) return 0;
    // Handle AM/PM in parseTime too just in case
    if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
        timeStr = convertTo24Hour(timeStr);
    }
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2) return 0;
    return parts[0] * 60 + parts[1];
}

// Shortcut keys
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        loadAttendanceList();
    }
});

function getDutyHoursDisplay(emp) {
    if (!emp) return '0h';
    if (emp.totalHrs && emp.totalHrs !== '0h') return emp.totalHrs;

    // Fallback: calculate from duty times
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
            return '0h';
        }
    }
    return emp.totalHrs || '0h';
}
