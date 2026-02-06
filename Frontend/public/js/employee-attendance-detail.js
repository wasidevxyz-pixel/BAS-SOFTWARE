let currentEmployeeId = null;
let currentEmployeeData = null;
let attendanceRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentEmployeeId = urlParams.get('id');
    const paramDate = urlParams.get('date');

    if (!currentEmployeeId) {
        alert('Employee ID is missing');
        window.history.back();
        return;
    }

    setDefaultDates(paramDate);
    await loadEmployeeInfo();
    await loadEmployeeMonthData();
});

function setDefaultDates(paramDate) {
    let baseDate = paramDate ? new Date(paramDate) : new Date();

    // Set to start and end of month
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const formatDate = (date) => `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(lastDay);
}

async function loadEmployeeInfo() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/employees/${currentEmployeeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            currentEmployeeData = data.data;

            // Populate Print Grid directly (since screen grid is removed)
            if (document.getElementById('pNameGrid')) document.getElementById('pNameGrid').textContent = currentEmployeeData.name;
            if (document.getElementById('pCodeGrid')) document.getElementById('pCodeGrid').textContent = currentEmployeeData.code;
            if (document.getElementById('pBranchGrid')) document.getElementById('pBranchGrid').textContent = currentEmployeeData.branch;
            if (document.getElementById('pDeptGrid')) document.getElementById('pDeptGrid').textContent = currentEmployeeData.department?.name || '-';
            if (document.getElementById('pDesigGrid')) document.getElementById('pDesigGrid').textContent = currentEmployeeData.designation?.name || '-';
        }
    } catch (err) { console.error(err); }
}

async function loadEmployeeMonthData() {
    const tbody = document.getElementById('detailRecordsBody');
    tbody.innerHTML = '<tr><td colspan="17" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;

        // Update Screen Header Date Range
        if (document.getElementById('dispDateRange')) {
            document.getElementById('dispDateRange').textContent = `${fromDate} to ${toDate}`;
        }

        const res = await fetch(`/api/v1/attendance?employee=${currentEmployeeId}&from=${fromDate}&to=${toDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            const recorded = data.data;

            // Generate full range of dates
            const start = new Date(fromDate);
            const end = new Date(toDate);
            const fullRange = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

                // For comparison, handle cases where DB date is string or date object
                const record = recorded.find(r => {
                    const rDate = new Date(r.date);
                    const rDateStr = `${rDate.getFullYear()}-${(rDate.getMonth() + 1).toString().padStart(2, '0')}-${rDate.getDate().toString().padStart(2, '0')}`;
                    return rDateStr === dateStr;
                });

                if (record) {
                    fullRange.push(record);
                } else {
                    fullRange.push({
                        _id: `new_${currentEmployeeId}_${dateStr}`,
                        employee: currentEmployeeData,
                        date: dateStr,
                        branch: currentEmployeeData.branch,
                        displayStatus: 'Present',
                        checkIn: '',
                        checkOut: '',
                        workedHrs: '',
                        isNew: true
                    });
                }
            }

            attendanceRecords = fullRange;
            renderDetailTable();
        }
    } catch (err) { console.error(err); }
}

function renderDetailTable() {
    const tbody = document.getElementById('detailRecordsBody');
    tbody.innerHTML = '';

    attendanceRecords.forEach((att, index) => {
        const tr = document.createElement('tr');
        // Initial color based on strict rules
        tr.className = '';
        const workedMins = parseTime(att.workedHrs);
        if (workedMins >= 1020) {
            tr.className = 'row-overtime';
        } else if (workedMins > 0 && workedMins <= 60) {
            tr.className = 'row-warning';
        } else if (att.checkIn && att.checkOut) {
            tr.className = 'row-completed';
        } else if (att.checkIn) {
            tr.className = 'row-partial';
        } else if (att.displayStatus === 'Absent') {
            tr.className = 'row-absent';
        } else if (att.displayStatus === 'Leave') {
            tr.className = 'row-leave';
        }

        const date = new Date(att.date);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[date.getDay()];
        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td class="text-center col-del"><button class="btn btn-danger btn-delete" onclick="deleteRecord('${att._id}')"><i class="fas fa-times"></i></button></td>
            <td class="text-center">${index + 1}</td>
            <td class="text-center col-date" style="font-weight: 600;">${dateStr}</td>
            <td class="text-center">${dayName}</td>
            <td class="px-1 col-checkin">
                <input type="time" class="form-control form-control-xs text-center fw-bold" value="${convertTo24Hour(att.checkIn)}" oninput="updateRowCalc(this)">
                <span class="print-value">${att.checkIn || ''}</span>
            </td>
            <td class="px-1 col-checkout">
                <input type="time" class="form-control form-control-xs text-center fw-bold" value="${convertTo24Hour(att.checkOut)}" oninput="updateRowCalc(this)">
                <span class="print-value">${att.checkOut || ''}</span>
            </td>
            <td class="text-center fw-bold col-worked">${att.workedHrs || ''}</td>
            <td class="px-1 col-breakout">
                <input type="time" class="form-control form-control-xs text-center" value="${convertTo24Hour(att.breakOut)}" oninput="updateRowCalc(this)">
                <span class="print-value">${att.breakOut || ''}</span>
            </td>
            <td class="px-1 col-breakin">
                <input type="time" class="form-control form-control-xs text-center" value="${convertTo24Hour(att.breakIn)}" oninput="updateRowCalc(this)">
                <span class="print-value">${att.breakIn || ''}</span>
            </td>
            <td class="text-center col-breakhrs">${att.breakHrs || ''}</td>
            <td class="px-0 col-diff-btns">
                <div class="diff-btns" data-mode="${att.diffMode || '+'}">
                    <button class="btn btn-diff btn-success ${(!att.diffMode || att.diffMode === '+') ? '' : 'opacity-50'}" onclick="setDiffMode(this, '+')">+</button>
                    <button class="btn btn-diff btn-danger ${att.diffMode === '-' ? '' : 'opacity-50'}" onclick="setDiffMode(this, '-')">-</button>
                </div>
            </td>
            <td class="px-1 col-diffin"><input type="time" class="input-diff-box" value="${convertTo24Hour(att.timeDiffIn)}" oninput="updateRowCalc(this)"></td>
            <td class="px-1 col-diffout"><input type="time" class="input-diff-box" value="${convertTo24Hour(att.timeDiffOut)}" oninput="updateRowCalc(this)"></td>
            <td class="text-center fw-bold text-primary col-totaldiff">${att.totalDiffHrs || ''}</td>
            <td class="text-center fw-bold col-totalhrs">${att.workedHrs || ''}</td>
            <td class="px-1 text-center col-status">
                <select class="form-select form-select-xs fw-bold" onchange="updateRowColor(this)">
                    <option value="Present" ${att.displayStatus === 'Present' ? 'selected' : ''}>P</option>
                    <option value="Absent" ${att.displayStatus === 'Absent' ? 'selected' : ''}>A</option>
                    <option value="Leave" ${att.displayStatus === 'Leave' ? 'selected' : ''}>L</option>
                    <option value="Half Day" ${att.displayStatus === 'Half Day' ? 'selected' : ''}>H</option>
                </select>
                <span class="print-value">${att.displayStatus ? att.displayStatus.charAt(0) : ''}</span>
            </td>
            <td class="px-1 col-remarks"><input type="text" class="form-control form-control-xs" value="${att.remarks || ''}"></td>
        `;
        tbody.appendChild(tr);
        updateRowCalc(tr.querySelector('input[type="time"]')); // Initial calc for each row
    });
    calculateTotals();
}

function updateRowColor(element) {
    const tr = element.closest('tr');
    const status = tr.cells[15].querySelector('select').value;
    const checkIn = tr.cells[4].querySelector('input').value;
    const checkOut = tr.cells[5].querySelector('input').value;
    const totalHrsText = tr.cells[14].textContent;
    const mins = parseTime(totalHrsText);

    tr.className = '';
    if (mins >= 1020) {
        tr.className = 'row-overtime';
    } else if (mins > 0 && mins <= 60) {
        tr.className = 'row-warning';
    } else if (checkIn && checkOut) {
        tr.className = 'row-completed';
    } else if (checkIn) {
        tr.className = 'row-partial';
    } else if (status === 'Absent') {
        tr.className = 'row-absent';
    } else if (status === 'Leave') {
        tr.className = 'row-leave';
    }
}

function setDiffMode(btn, mode) {
    const parent = btn.closest('.diff-btns');
    parent.dataset.mode = mode;
    parent.querySelectorAll('.btn-diff').forEach(b => b.classList.add('opacity-50'));
    btn.classList.remove('opacity-50');
    updateRowCalc(btn);
}

function updateRowCalc(element) {
    if (!element) return;
    const tr = element.closest('tr');
    const checkIn = tr.cells[4].querySelector('input').value;
    const checkOut = tr.cells[5].querySelector('input').value;
    const breakOut = tr.cells[7].querySelector('input').value;
    const breakIn = tr.cells[8].querySelector('input').value;
    const diffIn = tr.cells[11].querySelector('input').value;
    const diffOut = tr.cells[12].querySelector('input').value;
    const mode = tr.cells[10].querySelector('.diff-btns').dataset.mode || '+';

    let bMin = 0;
    if (breakOut && breakIn) {
        const inParts = breakIn.split(':').map(Number);
        const outParts = breakOut.split(':').map(Number);
        bMin = (inParts[0] * 60 + inParts[1]) - (outParts[0] * 60 + outParts[1]);
        if (bMin < 0) bMin += 1440;
        tr.cells[9].textContent = `${Math.floor(bMin / 60)}:${(bMin % 60).toString().padStart(2, '0')}`;
    } else {
        tr.cells[9].textContent = '';
    }

    let totalDiffMin = 0;
    if (diffIn && diffOut) {
        const inParts = diffIn.split(':').map(Number);
        const outParts = diffOut.split(':').map(Number);
        totalDiffMin = (outParts[0] * 60 + outParts[1]) - (inParts[0] * 60 + inParts[1]);
        if (totalDiffMin < 0) totalDiffMin += 1440;
        tr.cells[13].textContent = `${Math.floor(totalDiffMin / 60)}:${(totalDiffMin % 60).toString().padStart(2, '0')}`;
    } else {
        tr.cells[13].textContent = '';
    }

    if (checkIn && checkOut) {
        const cin = checkIn.split(':').map(Number);
        const cout = checkOut.split(':').map(Number);
        let wMin = (cout[0] * 60 + cout[1]) - (cin[0] * 60 + cin[1]);
        if (wMin < 0) wMin += 1440;

        let netMin = wMin - bMin;
        if (netMin < 0) netMin = 0;
        tr.cells[6].textContent = `${Math.floor(netMin / 60)}:${(netMin % 60).toString().padStart(2, '0')}`;

        let finalMin = netMin;
        if (mode === '+') finalMin += totalDiffMin;
        else finalMin -= totalDiffMin;
        if (finalMin < 0) finalMin = 0;

        const fStr = `${Math.floor(finalMin / 60)}:${(finalMin % 60).toString().padStart(2, '0')}`;
        tr.cells[14].textContent = fStr;

        // Helper to clear if incomplete
        if (!checkIn || !checkOut) {
            tr.cells[6].textContent = '';
            tr.cells[14].textContent = '';
        }
    } else {
        tr.cells[6].textContent = '';
        tr.cells[14].textContent = '';
    }
    updateRowColor(tr);
    calculateTotals();
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
    return timeStr;
}

function parseTime(timeStr) {
    if (!timeStr) return 0;
    if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
        timeStr = convertTo24Hour(timeStr);
    }
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2) return 0;
    return parts[0] * 60 + parts[1];
}

function formatTime(totalMinutes) {
    if (!totalMinutes || totalMinutes === 0) return '';
    if (totalMinutes < 0) totalMinutes = 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

function calculateTotals() {
    let tWorked = 0, tBreak = 0, tDiff = 0, tFinal = 0;
    const rows = document.querySelectorAll('#detailRecordsBody tr');

    rows.forEach(row => {
        const workedStr = row.cells[6].textContent;
        const breakStr = row.cells[9].textContent;
        const diffStr = row.cells[13].textContent;
        const finalStr = row.cells[14].textContent;

        if (workedStr) tWorked += parseTime(workedStr);
        if (breakStr) tBreak += parseTime(breakStr);
        if (diffStr) tDiff += parseTime(diffStr);
        if (finalStr) tFinal += parseTime(finalStr);
    });

    if (document.getElementById('tWorkedHrs')) document.getElementById('tWorkedHrs').textContent = formatTime(tWorked);
    if (document.getElementById('tBreakHrs')) document.getElementById('tBreakHrs').textContent = formatTime(tBreak);
    if (document.getElementById('tDiffHrs')) document.getElementById('tDiffHrs').textContent = formatTime(tDiff);
    if (document.getElementById('tFinalHrs')) document.getElementById('tFinalHrs').textContent = formatTime(tFinal);

    // Also update existing main summary if present
    if (document.getElementById('totalWorked')) document.getElementById('totalWorked').textContent = formatTime(tWorked);
    if (document.getElementById('totalBreak')) document.getElementById('totalBreak').textContent = formatTime(tBreak);
    if (document.getElementById('totalDiff')) document.getElementById('totalDiff').textContent = formatTime(tDiff);
    if (document.getElementById('totalFinal')) document.getElementById('totalFinal').textContent = formatTime(tFinal);
}

async function saveAllVisible() {
    const rows = document.querySelectorAll('#detailRecordsBody tr');
    const token = localStorage.getItem('token');
    let successCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        const dateStr = attendanceRecords[i].date;
        const isNew = attendanceRecords[i]._id.startsWith('new_');

        const payload = {
            employee: currentEmployeeId,
            date: dateStr,
            branch: currentEmployeeData.branch,
            checkIn: tr.cells[4].querySelector('input').value,
            checkOut: tr.cells[5].querySelector('input').value,
            workedHrs: tr.cells[6].textContent,
            breakOut: tr.cells[7].querySelector('input').value,
            breakIn: tr.cells[8].querySelector('input').value,
            breakHrs: tr.cells[9].textContent,
            diffMode: tr.cells[10].querySelector('.diff-btns').dataset.mode,
            timeDiffIn: tr.cells[11].querySelector('input').value,
            timeDiffOut: tr.cells[12].querySelector('input').value,
            totalDiffHrs: tr.cells[13].textContent,
            displayStatus: tr.cells[15].querySelector('select').value,
            remarks: tr.cells[16].querySelector('input').value,
            isPresent: tr.cells[15].querySelector('select').value === 'Present'
        };

        if (isNew && !payload.checkIn && !payload.checkOut && payload.displayStatus === 'Present') continue; // Don't save empty present rows

        // Prevent saving if hours are negative
        if (payload.workedHrs && payload.workedHrs.startsWith('-')) {
            alert(`Negative Worked Hours at row ${i + 1} (${dateStr}). Please correct.`);
            return;
        }
        if (payload.breakHrs && payload.breakHrs.startsWith('-')) {
            alert(`Negative Break Hours at row ${i + 1} (${dateStr}). Please correct.`);
            return;
        }
        if (payload.totalDiffHrs && payload.totalDiffHrs.startsWith('-')) {
            alert(`Negative Total Difference at row ${i + 1} (${dateStr}). Please correct.`);
            return;
        }

        try {
            const url = isNew ? '/api/v1/attendance' : `/api/v1/attendance/${attendanceRecords[i]._id}`;
            const method = isNew ? 'POST' : 'PUT';
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            successCount++;
        } catch (err) { console.error(err); }
    }
    alert(`Saved ${successCount} records successfully`);
    loadEmployeeMonthData();
}

async function deleteRecord(id) {
    if (id.startsWith('new_')) return;
    if (!confirm('Delete this record?')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/attendance/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            loadEmployeeMonthData();
        }
    } catch (err) { console.error(err); }
}
function handlePrint() {
    // Data is already populated in loadEmployeeInfo directly into key print fields
    // Just need to update the date range
    document.getElementById('pDateRangeGrid').textContent = `${document.getElementById('fromDate').value} to ${document.getElementById('toDate').value}`;
    window.print();
}

// Shortcut keys
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveAllVisible();
    }
});
