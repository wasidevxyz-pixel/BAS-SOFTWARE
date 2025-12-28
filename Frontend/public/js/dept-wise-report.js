// Department-Wise Report Logic

let allBranches = [];
let allDepartments = [];

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Set Default Dates (Current Month)
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Format to YYYY-MM-DD for input type="date"
    const formatDate = (d) => {
        let month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    };

    document.getElementById('fromDate').value = formatDate(firstDay);
    document.getElementById('toDate').value = formatDate(lastDay);

    loadFilters();
});

async function loadFilters() {
    try {
        const token = localStorage.getItem('token');

        // Load Branches
        const branchRes = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const branchData = await branchRes.json();
        if (branchData.success) {
            allBranches = branchData.data;
            const branchSelect = document.getElementById('branchSelect');
            branchSelect.innerHTML = '<option value="">All Branches</option>'; // Clear default options

            // Get Logged In User
            const user = JSON.parse(localStorage.getItem('user')) || {};
            const userBranch = user.branch;

            // Filter stores based on user's branch access
            const validStores = allBranches.filter(store => {
                const uBranch = String(userBranch || '').trim().toLowerCase();
                if (!uBranch || uBranch.includes('all branches')) return true;

                const sName = (store.name || '').trim().toLowerCase();
                return uBranch.includes(sName);
            });

            validStores.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b._id;
                opt.textContent = b.name;
                opt.setAttribute('data-name', b.name);
                branchSelect.appendChild(opt);
            });

            // Auto-select if user has only one branch
            if (validStores.length === 1) {
                branchSelect.value = validStores[0]._id;
            } else if (userBranch) {
                const uBranch = String(userBranch).trim().toLowerCase();
                const match = validStores.find(s => (s.name || '').trim().toLowerCase() === uBranch);
                if (match) branchSelect.value = match._id;
            }
        }

        // Setup branch change listener to reload departments when branch changes
        document.getElementById('branchSelect').addEventListener('change', loadDepartmentsForBranch);

        // Initial load of departments for selected/default branch
        loadDepartmentsForBranch();

    } catch (err) {
        console.error('Error loading filters', err);
    }
}

async function loadDepartmentsForBranch() {
    const branchSelect = document.getElementById('branchSelect');
    const branchId = branchSelect.value;
    const deptSelect = document.getElementById('deptSelect');

    // Clear current options except "All"
    deptSelect.innerHTML = '<option value="">All Departments</option>';

    try {
        const token = localStorage.getItem('token');

        // Fetch all departments (API doesn't support branch filtering)
        const response = await fetch('/api/v1/departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const result = await response.json();
            let allDepts = result.data || [];
            console.log('Total departments fetched:', allDepts.length);

            // Get selected branch name for filtering
            let branchName = '';
            if (branchId) {
                const selectedOption = branchSelect.options[branchSelect.selectedIndex];
                branchName = selectedOption.getAttribute('data-name');
                console.log('Selected branch:', branchName);
            } else {
                console.log('No branch selected (All Branches)');
            }

            // Filter departments based on branch selection
            let filteredDepts = allDepts;
            if (branchName) {
                // Filter by branch AND active status AND closing2DeptDropDown flag
                filteredDepts = allDepts.filter(d =>
                    d.branch === branchName &&
                    d.isActive &&
                    d.closing2DeptDropDown
                );
                console.log(`Departments for branch "${branchName}":`, filteredDepts.length);
            } else {
                // If "All Branches" selected, show all active departments with closing2DeptDropDown
                filteredDepts = allDepts.filter(d =>
                    d.isActive &&
                    d.closing2DeptDropDown
                );
                console.log('Departments for all branches:', filteredDepts.length);
            }

            console.log('Filtered departments:', filteredDepts.map(d => `${d.name} (${d.branch})`));

            // Get unique department names (in case multiple branches have same dept name)
            const uniqueDepts = [];
            const seen = new Set();

            filteredDepts.forEach(d => {
                if (!seen.has(d.name)) {
                    seen.add(d.name);
                    uniqueDepts.push(d);
                }
            });

            // Sort by name
            uniqueDepts.sort((a, b) => a.name.localeCompare(b.name));

            console.log('Unique departments to show:', uniqueDepts.map(d => d.name));

            // Populate dropdown
            uniqueDepts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name; // Filter by name for reports
                opt.textContent = d.name;
                deptSelect.appendChild(opt);
            });

            console.log('Department dropdown populated with', uniqueDepts.length, 'options');
        } else {
            console.error('Failed to fetch departments, status:', response.status);
        }
    } catch (e) {
        console.error("Error fetching departments", e);
    }
}

async function generateReport() {
    const btn = document.querySelector('.btn-generate');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Generating...';

    const branchId = document.getElementById('branchSelect').value;
    const branchName = branchId ? document.getElementById('branchSelect').options[document.getElementById('branchSelect').selectedIndex].getAttribute('data-name') : '';

    const deptName = document.getElementById('deptSelect').value;
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;

    try {
        // Use the new department-wise report endpoint that gets data from closing02
        const token = localStorage.getItem('token');
        let url = `/api/v1/closing-sheets/department-wise-report?startDate=${fromDate}&endDate=${toDate}`;

        if (branchId && branchName) {
            url += `&branch=${encodeURIComponent(branchName)}`;
        } else {
            url += `&branch=all`;
        }

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('API Endpoint not found (404). The backend server may need a restart to apply recent updates.');
            }
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const rawData = result.data || [];

        // Apply Department Filter if set
        let reportItems = rawData;
        if (deptName) {
            reportItems = rawData.filter(item => item.dept === deptName);
        }

        // Transform data to match report format
        // The API returns: { branch, dept, totalSaleComputer, discountValue, discountPer, dailyAverage, ... }
        const transformedItems = reportItems.map(item => {
            const net = item.totalSaleComputer || 0; // This is the Net Computer Sale from Closing Sheet 2
            const discount = item.discountValue || 0;
            const discountPer = item.discountPer || 0;
            const dailyAverage = item.dailyAverage || 0;

            return {
                key: `${item.branch}-${item.dept}`,
                branch: item.branch,
                dept: item.dept,
                discount: discount,
                discountPer: discountPer,
                net: net,
                dailyAverage: dailyAverage
            };
        });

        renderReport(transformedItems);
        updateSummary(transformedItems);

    } catch (err) {
        console.error('Report Generation Error', err);
        document.getElementById('reportTableBody').innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error generating report: ${err.message}</td></tr>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function updateSummary(data) {
    let tDisc = 0, tNet = 0;

    data.forEach(d => {
        tDisc += d.discount;
        tNet += d.net;
    });

    // Update summary cards
    document.getElementById('totalDiscount').textContent = formatCurrency(tDisc);

    // Update Branch Card
    const branchSelect = document.getElementById('branchSelect');
    const summaryBranchName = document.getElementById('summaryBranchName');
    if (summaryBranchName) {
        const selectedOption = branchSelect.options[branchSelect.selectedIndex];
        summaryBranchName.textContent = (selectedOption && selectedOption.value) ? selectedOption.text : 'All Branches';
    }
    document.getElementById('netSale').textContent = formatCurrency(tNet);
}

function renderReport(data) {
    const table = document.querySelector('.custom-table');
    // Clear existing tbodies (except the main one if we are replacing it, but here we replace structure)
    // Note: The HTML has a single tbody id="reportTableBody". We will REMOVE it and append new tbodies.

    // Find existing tbodies and remove them (to reset)
    const oldTbodies = table.querySelectorAll('tbody');
    oldTbodies.forEach(tb => tb.remove());

    const tfoot = document.getElementById('reportTableFoot');

    if (data.length === 0) {
        const tbody = document.createElement('tbody');
        tbody.id = 'reportTableBody';
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No records found for the selected criteria.</td></tr>';
        table.insertBefore(tbody, tfoot);
        tfoot.style.display = 'none';
        return;
    }

    // Sort by Branch then Dept
    data.sort((a, b) => {
        if (a.branch === b.branch) return a.dept.localeCompare(b.dept);
        return a.branch.localeCompare(b.branch);
    });

    // Group by Branch
    const groups = {};
    data.forEach(item => {
        if (!groups[item.branch]) groups[item.branch] = [];
        groups[item.branch].push(item);
    });

    let tDisc = 0, tNet = 0, tDaily = 0;

    // Render Groups
    Object.keys(groups).forEach(branchName => {
        const items = groups[branchName];
        const tbody = document.createElement('tbody');
        tbody.className = 'branch-group';

        // Add rows
        items.forEach((item, index) => {
            tDisc += item.discount;
            tNet += item.net;
            tDaily += item.dailyAverage;

            const row = document.createElement('tr');

            // Branch Cell: Only show on first row for desktop (rowspan) or handle via CSS
            // For Mobile "One Card": We want the Branch Name visible. 
            // We can put Branch Name in the first column of every row, and use CSS to hide duplicates or style the first one as header.
            // BETTER APPORACH for Mobile Card:
            // The first row of the tbody acts as the "Header" containing the branch name.

            row.innerHTML = `
                <td data-label="Branch">${item.branch}</td>
                <td data-label="Department"><span class="badge bg-light text-dark border">${item.dept}</span></td>
                <td data-label="Discount" class="text-end text-warning-dark" style="color:#d39e00;">${formatCurrency(item.discount)}</td>
                <td data-label="Disc %" class="text-end"><span class="badge bg-info">${item.discountPer.toFixed(2)}%</span></td>
                <td data-label="Net Sale" class="text-end fw-bold">${formatCurrency(item.net)}</td>
                <td data-label="Daily Average" class="text-end text-primary fw-bold">${formatCurrency(item.dailyAverage)}</td>
            `;
            tbody.appendChild(row);
        });

        // Add Branch Total Row
        const branchTotalRow = document.createElement('tr');
        branchTotalRow.className = 'branch-total-row';
        branchTotalRow.innerHTML = `
            <td colspan="2" class="text-end fw-bold bg-light">Total ${branchName}:</td>
            
            <!-- Mobile Labels for Total Row -->
            <td data-label="Total Discount" class="text-end fw-bold bg-light">${formatCurrency(items.reduce((sum, i) => sum + i.discount, 0))}</td>
            <td class="bg-light"></td> <!-- Skip % col -->
            <td data-label="Total Net Sale" class="text-end fw-bold bg-light text-success">${formatCurrency(items.reduce((sum, i) => sum + i.net, 0))}</td>
            <td data-label="Total Daily Avg" class="text-end fw-bold bg-light">${formatCurrency(items.reduce((sum, i) => sum + i.dailyAverage, 0))}</td>
        `;
        tbody.appendChild(branchTotalRow);

        table.insertBefore(tbody, tfoot);
    });

    // Footer Totals
    document.getElementById('tblDisc').textContent = formatCurrency(tDisc);
    document.getElementById('tblNet').textContent = formatCurrency(tNet);
    document.getElementById('tblDaily').textContent = formatCurrency(tDaily);

    tfoot.style.display = 'table-footer-group'; // Use proper display for tfoot
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}
