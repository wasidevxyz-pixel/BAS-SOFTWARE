// Income Statement JavaScript
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

async function initializePage() {
    // Set user name
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'Unknown' };
    document.getElementById('userName').textContent = user.name;

    // Load branches
    await loadBranches();

    // Set default dates (1st of current month to today)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    // Format dates as YYYY-MM-DD for input fields
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    document.getElementById('startDateFilter').value = formatDate(firstDay);
    document.getElementById('endDateFilter').value = formatDate(now);

    // Setup logout
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.pageAccess && window.pageAccess.logout) {
                window.pageAccess.logout();
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            }
        });
    });
}

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('branchFilter');
            const user = JSON.parse(localStorage.getItem('user')) || {};
            const userBranch = user.branch;

            // Filter stores based on user branch
            const validStores = data.data.filter(store => {
                const uBranch = String(userBranch || '').trim().toLowerCase();
                if (!uBranch || uBranch.includes('all branches')) return true;
                const sName = (store.name || '').trim().toLowerCase();
                return uBranch.includes(sName);
            });

            validStores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.name;
                option.textContent = store.name;
                select.appendChild(option);
            });

            // Auto-select if only one branch
            if (validStores.length === 1) {
                select.value = validStores[0].name;
            } else if (userBranch) {
                const uBranch = String(userBranch).trim().toLowerCase();
                const match = validStores.find(s => (s.name || '').trim().toLowerCase() === uBranch);
                if (match) select.value = match.name;
            }
        }
    } catch (error) {
        console.error('Error loading branches:', error);
        showError('Failed to load branches');
    }
}

async function loadIncomeStatement() {
    const branch = document.getElementById('branchFilter').value;
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;

    console.log('Loading Income Statement:', { branch, startDate, endDate });

    if (!branch) {
        showError('Please select a branch');
        return;
    }

    if (!startDate || !endDate) {
        showError('Please select start and end dates');
        return;
    }

    // Show loading
    document.getElementById('loadingSection').style.display = 'block';
    document.getElementById('reportContent').style.display = 'none';
    document.getElementById('noDataSection').style.display = 'none';

    try {
        const token = localStorage.getItem('token');
        const url = `/api/v1/income-statement?branch=${encodeURIComponent(branch)}&startDate=${startDate}&endDate=${endDate}`;
        console.log('Fetching:', url);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        console.log('API Response:', data);

        if (data.success && data.data) {
            console.log('Categories found:', data.data.categories?.length || 0);
            renderIncomeStatement(data.data);
        } else {
            console.error('API returned error:', data.message);
            showNoData();
            showError(data.message || 'Failed to load income statement');
        }
    } catch (error) {
        console.error('Error loading income statement:', error);
        showNoData();
        showError('Failed to load income statement: ' + error.message);
    } finally {
        document.getElementById('loadingSection').style.display = 'none';
    }
}

function renderIncomeStatement(data) {
    const { groups, totals, summary, period } = data;

    // Show report
    document.getElementById('reportContent').style.display = 'block';
    document.getElementById('noDataSection').style.display = 'none';

    // Update date range
    const startDate = new Date(period.startDate).toLocaleDateString('en-GB');
    const endDate = new Date(period.endDate).toLocaleDateString('en-GB');
    document.getElementById('dateRange').textContent = `${startDate} to ${endDate}`;

    // Render grouped departments
    const tbody = document.getElementById('incomeTableBody');
    tbody.innerHTML = '';

    if (groups && groups.length > 0) {
        groups.forEach(group => {
            // Add parent department header row (dark green)
            const headerRow = document.createElement('tr');
            headerRow.style.backgroundColor = '#2d5016';
            headerRow.style.color = 'white';
            headerRow.style.fontWeight = 'bold';
            headerRow.innerHTML = `
                <td colspan="7" style="padding: 10px;">
                    <i class="fas fa-folder-open me-2"></i>${group.parentName}
                </td>
            `;
            tbody.appendChild(headerRow);

            // Add sub-departments
            if (group.subDepartments && group.subDepartments.length > 0) {
                group.subDepartments.forEach(dept => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding-left: 30px;">${dept.department}</td>
                        <td class="number">${formatNumber(dept.sales)}</td>
                        <td class="number">${formatNumber(dept.cost)}</td>
                        <td class="number">${formatNumber(dept.bankDeduction)}</td>
                        <td class="number">${formatNumber(dept.grossProfit)}</td>
                        <td class="number">${formatNumber(dept.discount)}</td>
                        <td class="number">${formatNumber(dept.gpProfit)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Add subtotal row (pink background)
            const subtotalRow = document.createElement('tr');
            subtotalRow.style.backgroundColor = '#f8d7da';
            subtotalRow.style.fontWeight = 'bold';
            subtotalRow.innerHTML = `
                <td style="padding-left: 30px;">SUB-TOTAL:</td>
                <td class="number">${formatNumber(group.totals.sales)}</td>
                <td class="number">${formatNumber(group.totals.cost)}</td>
                <td class="number">${formatNumber(group.totals.bankDeduction)}</td>
                <td class="number">${formatNumber(group.totals.grossProfit)}</td>
                <td class="number">${formatNumber(group.totals.discount)}</td>
                <td class="number">${formatNumber(group.totals.gpProfit)}</td>
            `;
            tbody.appendChild(subtotalRow);
        });

        // Add grand total row
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td>TOTAL</td>
            <td class="number">${formatNumber(totals.sales)}</td>
            <td class="number">${formatNumber(totals.cost)}</td>
            <td class="number">${formatNumber(totals.bankDeduction)}</td>
            <td class="number">${formatNumber(totals.grossProfit)}</td>
            <td class="number">${formatNumber(totals.discount)}</td>
            <td class="number">${formatNumber(totals.gpProfit)}</td>
        `;
        tbody.appendChild(totalRow);
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No data available</td></tr>';
    }

    // Update summary section
    document.getElementById('summaryTotalSale').textContent = formatNumber(summary.totalSale);
    document.getElementById('summaryTotalReturns').textContent = formatNumber(summary.totalSaleReturns);
    document.getElementById('summaryNetSales').textContent = formatNumber(summary.netSales);
    document.getElementById('summaryCost').textContent = formatNumber(summary.cost);
    document.getElementById('summaryGrossProfit').textContent = formatNumber(summary.grossProfit);
    document.getElementById('summaryExpenses').textContent = formatNumber(summary.expenses);
    document.getElementById('summaryShortCash').textContent = formatNumber(summary.shortCash);
    document.getElementById('summaryNetProfit').textContent = formatNumber(summary.netProfit);
}

function showNoData() {
    document.getElementById('reportContent').style.display = 'none';
    document.getElementById('noDataSection').style.display = 'block';
}

function showError(message) {
    console.error(message);
    alert(message);
}

function formatNumber(value) {
    if (value === null || value === undefined) return '0';
    return parseFloat(value).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function printReport() {
    window.print();
}

function exportToExcel() {
    const branch = document.getElementById('branchFilter').value;
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;

    // Get table data
    const table = document.querySelector('.income-table');
    if (!table) {
        showError('No data to export');
        return;
    }

    // Create CSV content
    let csv = `Income Statement - ${branch}\n`;
    csv += `${startDate} to ${endDate}\n\n`;

    // Add main table
    csv += 'CATEGORY,SALES,COST,BANK DED.,G.P,DISCOUNT,GP PROFIT\n';

    const tbody = document.getElementById('incomeTableBody');
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => cell.textContent.trim().replace(/,/g, '')).join(',');
        csv += rowData + '\n';
    });

    // Add summary
    csv += '\nSUMMARY\n';
    csv += `TOTAL SALE,${document.getElementById('summaryTotalSale').textContent}\n`;
    csv += `TOTAL SALE RETURNS,${document.getElementById('summaryTotalReturns').textContent}\n`;
    csv += `NET SALES,${document.getElementById('summaryNetSales').textContent}\n`;
    csv += `COST,${document.getElementById('summaryCost').textContent}\n`;
    csv += `G.PROFIT,${document.getElementById('summaryGrossProfit').textContent}\n`;
    csv += `EXPENSES,${document.getElementById('summaryExpenses').textContent}\n`;
    csv += `SHORT CASH,${document.getElementById('summaryShortCash').textContent}\n`;
    csv += `NET PROFIT,${document.getElementById('summaryNetProfit').textContent}\n`;

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Income_Statement_${branch}_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
