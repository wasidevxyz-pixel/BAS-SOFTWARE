// Reports Management JavaScript
let currentReportType = null;
let currentReportData = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Set user name
    setUserName();

    // Set default date range (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('reportStartDate').valueAsDate = firstDay;
    document.getElementById('reportEndDate').valueAsDate = today;

    // Check for report type parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const reportType = urlParams.get('type');
    if (reportType) {
        openReport(reportType);
    }
});

// Set user name
function setUserName() {
    const user = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = user.name || user.email;
    }
}

// Open specific report
function openReport(reportType) {
    currentReportType = reportType;

    // Hide report cards, show report display
    // Hide all report cards containers
    document.querySelectorAll('.row.mb-4').forEach(row => {
        if (!row.closest('#reportCard')) {
            row.style.display = 'none';
        }
    });
    document.getElementById('reportCard').style.display = 'block';

    // Set report title and configure filters
    configureReport(reportType);

    // Generate report
    generateReport();
}

// Configure report based on type
function configureReport(reportType) {
    const titles = {
        'sales': 'Sales Report',
        'purchase': 'Purchase Report',
        'stock': 'Stock Report',
        'profit-loss': 'Profit & Loss Statement',
        'ledger': 'Ledger Report',
        'party-statement': 'Party Statement',
        'stock-adjustment': 'Stock Adjustment Report',
        'stock-audit': 'Stock Audit Report',
        'supplier-payments': 'Supplier Payments Report',
        'customer-payments': 'Customer Receipts Report',
        'vouchers': 'Voucher Report',
        'expenses': 'Expense Report'
    };

    document.getElementById('reportTitle').textContent = titles[reportType] || 'Report';

    // Configure filter dropdown based on report type
    const filterSelect = document.getElementById('reportFilter');
    filterSelect.innerHTML = '<option value="">All</option>';

    switch (reportType) {
        case 'sales':
        case 'purchase':
            filterSelect.innerHTML += `
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="cheque">Cheque</option>
            `;
            break;
        case 'party-statement':
            // Load parties for filter
            loadPartiesFilter();
            break;
        case 'stock':
            filterSelect.innerHTML += `
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
            `;
            break;
    }
}

// Load parties for filter
async function loadPartiesFilter() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/parties', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const filterSelect = document.getElementById('reportFilter');
            filterSelect.innerHTML = '<option value="">All Parties</option>';

            if (data.data) {
                data.data.forEach(party => {
                    filterSelect.innerHTML += `<option value="${party._id}">${party.name}</option>`;
                });
            }
        }
    } catch (error) {
        console.error('Error loading parties:', error);
    }
}

// Generate report
async function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const filter = document.getElementById('reportFilter').value;

    if (!startDate || !endDate) {
        alert('Please select date range');
        return;
    }

    try {
        showLoading();

        switch (currentReportType) {
            case 'sales':
                await generateSalesReport(startDate, endDate, filter);
                break;
            case 'purchase':
                await generatePurchaseReport(startDate, endDate, filter);
                break;
            case 'stock':
                await generateStockReport(filter);
                break;
            case 'profit-loss':
                await generateProfitLossReport(startDate, endDate);
                break;
            case 'ledger':
                await generateLedgerReport(startDate, endDate);
                break;
            case 'party-statement':
                await generatePartyStatement(startDate, endDate, filter);
                break;
            case 'stock-adjustment':
                await generateStockAdjustmentReport(startDate, endDate);
                break;
            case 'stock-audit':
                await generateStockAuditReport(startDate, endDate);
                break;
            case 'supplier-payments':
                await generateSupplierPaymentReport(startDate, endDate);
                break;
            case 'customer-payments':
                await generateCustomerPaymentReport(startDate, endDate);
                break;
            case 'vouchers':
                await generateVoucherReport(startDate, endDate);
                break;
            case 'expenses':
                await generateExpenseReport(startDate, endDate);
                break;
        }
    } catch (error) {
        console.error('Error generating report:', error);
        showError('Failed to generate report');
    } finally {
        hideLoading();
    }
}

// Generate Sales Report
async function generateSalesReport(startDate, endDate, paymentMode) {
    const token = localStorage.getItem('token');
    let url = `/api/v1/sales?startDate=${startDate}&endDate=${endDate}`;
    if (paymentMode) url += `&paymentMode=${paymentMode}`;

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderSalesReport(data.data);
    }
}

// Render Sales Report
function renderSalesReport(sales) {
    let totalAmount = 0;
    let totalTax = 0;

    const rows = sales.map((sale, index) => {
        totalAmount += sale.grandTotal || 0;
        totalTax += sale.taxAmount || 0;

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(sale.date).toLocaleDateString()}</td>
                <td>${sale.invoiceNumber || sale.invoiceNo || '-'}</td>
                <td>${sale.party?.name || sale.customer?.name || '-'}</td>
                <td>${sale.paymentMode || '-'}</td>
                <td class="text-end">${(sale.subTotal || 0).toFixed(2)}</td>
                <td class="text-end">${(sale.taxAmount || 0).toFixed(2)}</td>
                <td class="text-end fw-bold">${(sale.grandTotal || 0).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Invoice No</th>
                        <th>Customer</th>
                        <th>Payment Mode</th>
                        <th class="text-end">Subtotal</th>
                        <th class="text-end">Tax</th>
                        <th class="text-end">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="8" class="text-center">No records found</td></tr>'}
                </tbody>
                <tfoot class="table-secondary">
                    <tr>
                        <th colspan="5" class="text-end">Total:</th>
                        <th class="text-end">${(totalAmount - totalTax).toFixed(2)}</th>
                        <th class="text-end">${totalTax.toFixed(2)}</th>
                        <th class="text-end">${totalAmount.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// Generate Purchase Report
async function generatePurchaseReport(startDate, endDate, paymentMode) {
    const token = localStorage.getItem('token');
    let url = `/api/v1/purchases?startDate=${startDate}&endDate=${endDate}`;
    if (paymentMode) url += `&paymentMode=${paymentMode}`;

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderPurchaseReport(data.data);
    }
}

// Render Purchase Report
function renderPurchaseReport(purchases) {
    let totalAmount = 0;
    let totalTax = 0;

    const rows = purchases.map((purchase, index) => {
        totalAmount += purchase.grandTotal || 0;
        totalTax += purchase.taxAmount || 0;

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(purchase.date).toLocaleDateString()}</td>
                <td>${purchase.invoiceNo || '-'}</td>
                <td>${purchase.supplier?.name || purchase.party?.name || '-'}</td>
                <td>${purchase.paymentMode || purchase.payMode || '-'}</td>
                <td class="text-end">${(purchase.subTotal || 0).toFixed(2)}</td>
                <td class="text-end">${(purchase.taxAmount || 0).toFixed(2)}</td>
                <td class="text-end fw-bold">${(purchase.grandTotal || 0).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Invoice No</th>
                        <th>Supplier</th>
                        <th>Payment Mode</th>
                        <th class="text-end">Subtotal</th>
                        <th class="text-end">Tax</th>
                        <th class="text-end">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="8" class="text-center">No records found</td></tr>'}
                </tbody>
                <tfoot class="table-secondary">
                    <tr>
                        <th colspan="5" class="text-end">Total:</th>
                        <th class="text-end">${(totalAmount - totalTax).toFixed(2)}</th>
                        <th class="text-end">${totalTax.toFixed(2)}</th>
                        <th class="text-end">${totalAmount.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// Generate Stock Report
async function generateStockReport(filter) {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/v1/items', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        let items = data.data;

        // Apply filter
        if (filter === 'low-stock') {
            items = items.filter(item => item.stockQty > 0 && item.stockQty <= (item.minStock || 10));
        } else if (filter === 'out-of-stock') {
            items = items.filter(item => item.stockQty <= 0);
        }

        currentReportData = items;
        renderStockReport(items);
    }
}

// Render Stock Report
function renderStockReport(items) {
    const rows = items.map((item, index) => {
        const stockValue = (item.stockQty || 0) * (item.costPrice || 0);
        const status = item.stockQty <= 0 ? 'Out of Stock' :
            item.stockQty <= (item.minStock || 10) ? 'Low Stock' : 'In Stock';
        const statusClass = item.stockQty <= 0 ? 'danger' :
            item.stockQty <= (item.minStock || 10) ? 'warning' : 'success';

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${item.itemCode || '-'}</td>
                <td>${item.name}</td>
                <td>${item.category?.name || '-'}</td>
                <td class="text-end">${item.stockQty || 0}</td>
                <td>${item.unit || 'PCS'}</td>
                <td class="text-end">${(item.costPrice || 0).toFixed(2)}</td>
                <td class="text-end">${(item.salePrice || 0).toFixed(2)}</td>
                <td class="text-end fw-bold">${stockValue.toFixed(2)}</td>
                <td><span class="badge bg-${statusClass}">${status}</span></td>
            </tr>
        `;
    }).join('');

    const totalValue = items.reduce((sum, item) => sum + ((item.stockQty || 0) * (item.costPrice || 0)), 0);

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Code</th>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th class="text-end">Quantity</th>
                        <th>Unit</th>
                        <th class="text-end">Cost Price</th>
                        <th class="text-end">Sale Price</th>
                        <th class="text-end">Stock Value</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="10" class="text-center">No items found</td></tr>'}
                </tbody>
                <tfoot class="table-secondary">
                    <tr>
                        <th colspan="8" class="text-end">Total Stock Value:</th>
                        <th class="text-end">${totalValue.toFixed(2)}</th>
                        <th></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// Generate Profit & Loss Report
async function generateProfitLossReport(startDate, endDate) {
    const token = localStorage.getItem('token');

    // Fetch sales and purchases
    const [salesRes, purchasesRes, expensesRes] = await Promise.all([
        fetch(`/api/v1/sales?startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/v1/purchases?startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/v1/expenses?startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
    ]);

    const sales = salesRes.ok ? (await salesRes.json()).data : [];
    const purchases = purchasesRes.ok ? (await purchasesRes.json()).data : [];
    const expenses = expensesRes.ok ? (await expensesRes.json()).data : [];

    renderProfitLossReport(sales, purchases, expenses);
}

// Render Profit & Loss Report
function renderProfitLossReport(sales, purchases, expenses) {
    const totalSales = sales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.grandTotal || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

    const grossProfit = totalSales - totalPurchases;
    const netProfit = grossProfit - totalExpenses;

    document.getElementById('reportContent').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h5 class="text-success">Income</h5>
                <table class="table table-bordered">
                    <tr>
                        <td>Sales Revenue</td>
                        <td class="text-end fw-bold">${totalSales.toFixed(2)}</td>
                    </tr>
                    <tr class="table-success">
                        <th>Total Income</th>
                        <th class="text-end">${totalSales.toFixed(2)}</th>
                    </tr>
                </table>
            </div>
            <div class="col-md-6">
                <h5 class="text-danger">Expenses</h5>
                <table class="table table-bordered">
                    <tr>
                        <td>Cost of Goods Sold (Purchases)</td>
                        <td class="text-end fw-bold">${totalPurchases.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Operating Expenses</td>
                        <td class="text-end fw-bold">${totalExpenses.toFixed(2)}</td>
                    </tr>
                    <tr class="table-danger">
                        <th>Total Expenses</th>
                        <th class="text-end">${(totalPurchases + totalExpenses).toFixed(2)}</th>
                    </tr>
                </table>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-12">
                <table class="table table-bordered">
                    <tr class="table-info">
                        <th>Gross Profit (Sales - COGS)</th>
                        <th class="text-end">${grossProfit.toFixed(2)}</th>
                    </tr>
                    <tr class="${netProfit >= 0 ? 'table-success' : 'table-danger'}">
                        <th>Net Profit / Loss</th>
                        <th class="text-end fs-4">${netProfit.toFixed(2)}</th>
                    </tr>
                </table>
            </div>
        </div>
    `;
}

// Generate Ledger Report
async function generateLedgerReport(startDate, endDate) {
    const token = localStorage.getItem('token');

    try {
        // Fetch all transaction types directly
        const [salesRes, purchasesRes, salesReturnsRes, purchaseReturnsRes] = await Promise.all([
            fetch(`/api/v1/sales?startDate=${startDate}&endDate=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/v1/purchases?startDate=${startDate}&endDate=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/v1/sales-returns?startDate=${startDate}&endDate=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => ({ ok: false })),
            fetch(`/api/v1/purchase-returns?startDate=${startDate}&endDate=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => ({ ok: false }))
        ]);

        const sales = salesRes.ok ? (await salesRes.json()).data || [] : [];
        const purchases = purchasesRes.ok ? (await purchasesRes.json()).data || [] : [];
        const salesReturns = salesReturnsRes.ok ? (await salesReturnsRes.json()).data || [] : [];
        const purchaseReturns = purchaseReturnsRes.ok ? (await purchaseReturnsRes.json()).data || [] : [];

        // Combine all entries
        const entries = [];

        // Add sales
        sales.forEach(sale => {
            entries.push({
                date: sale.date,
                narration: `Sale Invoice #${sale.invoiceNumber || sale.invoiceNo}`,
                refType: 'Sale',
                debit: 0,
                credit: sale.grandTotal || 0
            });
        });

        // Add purchases
        purchases.forEach(purchase => {
            entries.push({
                date: purchase.date,
                narration: `Purchase Invoice #${purchase.invoiceNo}`,
                refType: 'Purchase',
                debit: purchase.grandTotal || 0,
                credit: 0
            });
        });

        // Add sales returns
        salesReturns.forEach(sr => {
            entries.push({
                date: sr.date,
                narration: `Sales Return #${sr.returnInvoiceNo}`,
                refType: 'Sales Return',
                debit: sr.totalReturnAmount || 0,
                credit: 0
            });
        });

        // Add purchase returns
        purchaseReturns.forEach(pr => {
            entries.push({
                date: pr.date,
                narration: `Purchase Return #${pr.returnInvoiceNo}`,
                refType: 'Purchase Return',
                debit: 0,
                credit: pr.totalReturnAmount || 0
            });
        });

        // Sort by date
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        currentReportData = entries;
        renderLedgerReport(entries);
    } catch (error) {
        console.error('Error generating ledger report:', error);
        throw error;
    }
}

// Render Ledger Report
function renderLedgerReport(entries) {
    let balance = 0;

    const rows = entries.map((entry, index) => {
        balance += (entry.debit || 0) - (entry.credit || 0);

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(entry.date).toLocaleDateString()}</td>
                <td>${entry.narration || '-'}</td>
                <td>${entry.refType || '-'}</td>
                <td class="text-end">${(entry.debit || 0).toFixed(2)}</td>
                <td class="text-end">${(entry.credit || 0).toFixed(2)}</td>
                <td class="text-end fw-bold">${balance.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Narration</th>
                        <th>Type</th>
                        <th class="text-end">Debit</th>
                        <th class="text-end">Credit</th>
                        <th class="text-end">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="7" class="text-center">No entries found</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Party Statement
async function generatePartyStatement(startDate, endDate, partyId) {
    if (!partyId) {
        alert('Please select a party');
        return;
    }

    const token = localStorage.getItem('token');

    // Fetch party details and transactions
    const [partyRes, salesRes, purchasesRes] = await Promise.all([
        fetch(`/api/v1/parties/${partyId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/v1/sales?party=${partyId}&startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/v1/purchases?supplier=${partyId}&startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
    ]);

    const party = partyRes.ok ? (await partyRes.json()).data : null;
    const sales = salesRes.ok ? (await salesRes.json()).data : [];
    const purchases = purchasesRes.ok ? (await purchasesRes.json()).data : [];

    renderPartyStatement(party, sales, purchases);
}

// Render Party Statement
function renderPartyStatement(party, sales, purchases) {
    if (!party) {
        document.getElementById('reportContent').innerHTML = '<p class="text-center">Party not found</p>';
        return;
    }

    // Combine and sort transactions
    const transactions = [
        ...sales.map(s => ({ ...s, type: 'Sale', amount: s.grandTotal })),
        ...purchases.map(p => ({ ...p, type: 'Purchase', amount: p.grandTotal }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = party.openingBalance || 0;

    const rows = transactions.map((txn, index) => {
        if (txn.type === 'Sale') {
            balance += txn.amount;
        } else {
            balance -= txn.amount;
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(txn.date).toLocaleDateString()}</td>
                <td>${txn.invoiceNumber || txn.invoiceNo || '-'}</td>
                <td>${txn.type}</td>
                <td class="text-end">${txn.type === 'Sale' ? txn.amount.toFixed(2) : '-'}</td>
                <td class="text-end">${txn.type === 'Purchase' ? txn.amount.toFixed(2) : '-'}</td>
                <td class="text-end fw-bold">${balance.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="card mb-3">
            <div class="card-body">
                <h5>${party.name}</h5>
                <p class="mb-1">Address: ${party.address?.street || '-'}</p>
                <p class="mb-1">Phone: ${party.phone || '-'} | Email: ${party.email || '-'}</p>
                <p class="mb-0">Opening Balance: <strong>${(party.openingBalance || 0).toFixed(2)}</strong></p>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Invoice No</th>
                        <th>Type</th>
                        <th class="text-end">Debit</th>
                        <th class="text-end">Credit</th>
                        <th class="text-end">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="7" class="text-center">No transactions found</td></tr>'}
                </tbody>
                <tfoot class="table-secondary">
                    <tr>
                        <th colspan="6" class="text-end">Closing Balance:</th>
                        <th class="text-end">${balance.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// Close report
function closeReport() {
    document.getElementById('reportCard').style.display = 'none';
    // Show all report cards
    document.querySelectorAll('.row.mb-4').forEach(row => {
        if (!row.closest('#reportCard')) {
            row.style.display = 'flex';
        }
    });
    currentReportType = null;
    currentReportData = null;
}

// Print report
function printReport() {
    window.print();
}

// Export report (CSV)
function exportReport() {
    if (!currentReportData || currentReportData.length === 0) {
        alert('No data to export');
        return;
    }

    // Simple CSV export
    let csv = '';
    const headers = Object.keys(currentReportData[0]);
    csv += headers.join(',') + '\n';

    currentReportData.forEach(row => {
        csv += headers.map(h => row[h] || '').join(',') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentReportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Helper functions
function showLoading() {
    document.getElementById('reportContent').innerHTML = '<div class="text-center py-5"><div class="spinner-border" role="status"></div><p class="mt-2">Loading report...</p></div>';
}

function hideLoading() {
    // Loading will be replaced by report content
}

function showError(message) {
    document.getElementById('reportContent').innerHTML = `<div class="alert alert-danger">${message}</div>`;
}

// Generate Stock Adjustment Report
async function generateStockAdjustmentReport(startDate, endDate) {
    const token = localStorage.getItem('token');
    // Assuming backend supports date range filter ?startDate=&endDate=
    const response = await fetch(`/api/v1/stock-adjustments/date-range?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderStockAdjustmentReport(data.data);
    } else {
        showError('Failed to fetch stock adjustments');
    }
}

function renderStockAdjustmentReport(adjustments) {
    const rows = adjustments.map((adj, index) => {
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(adj.date).toLocaleDateString()}</td>
                <td>${adj.adjustmentNo || '-'}</td>
                <td>${adj.adjustmentType || '-'}</td>
                <td>${adj.reason || '-'}</td>
                <td class="text-end">${(adj.totalAmount || 0).toFixed(2)}</td>
                <td><span class="badge bg-${adj.status === 'approved' ? 'success' : 'warning'}">${adj.status}</span></td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Adj No</th>
                        <th>Type</th>
                        <th>Reason</th>
                        <th class="text-end">Total Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="7" class="text-center">No records found</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Stock Audit Report
async function generateStockAuditReport(startDate, endDate) {
    const token = localStorage.getItem('token');
    // Assuming generic list endpoint supports date range or filter
    const response = await fetch(`/api/v1/stock-audits?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderStockAuditReport(data.data);
    } else {
        showError('Failed to fetch stock audits');
    }
}

function renderStockAuditReport(audits) {
    const rows = audits.map((audit, index) => {
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(audit.date).toLocaleDateString()}</td>
                <td>${audit.auditNo || '-'}</td>
                <td>${audit.remarks || '-'}</td>
                <td><span class="badge bg-${audit.status === 'posted' ? 'success' : 'secondary'}">${audit.status}</span></td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Audit No</th>
                        <th>Remarks</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="5" class="text-center">No records found</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Supplier Payment Report
async function generateSupplierPaymentReport(startDate, endDate) {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/v1/supplier-payments?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderSupplierPaymentReport(data.data);
    }
}

function renderSupplierPaymentReport(payments) {
    let total = 0;
    const rows = payments.map((pay, index) => {
        total += pay.amount || 0;
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(pay.date).toLocaleDateString()}</td>
                <td>${pay.paymentNo || '-'}</td>
                <td>${pay.supplier?.name || '-'}</td>
                <td>${pay.paymentMode || '-'}</td>
                <td class="text-end">${(pay.amount || 0).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Payment No</th>
                        <th>Supplier</th>
                        <th>Mode</th>
                        <th class="text-end">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" class="text-center">No records found</td></tr>'}
                </tbody>
                 <tfoot class="table-secondary">
                    <tr>
                        <th colspan="5" class="text-end">Total:</th>
                        <th class="text-end">${total.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// Generate Customer Payment Report
async function generateCustomerPaymentReport(startDate, endDate) {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/v1/customer-payments?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderCustomerPaymentReport(data.data);
    }
}

function renderCustomerPaymentReport(payments) {
    let total = 0;
    const rows = payments.map((pay, index) => {
        total += pay.amount || 0;
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(pay.date).toLocaleDateString()}</td>
                <td>${pay.receiptNo || '-'}</td>
                <td>${pay.customer?.name || '-'}</td>
                <td>${pay.paymentMode || '-'}</td>
                <td class="text-end">${(pay.amount || 0).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Receipt No</th>
                        <th>Customer</th>
                        <th>Mode</th>
                        <th class="text-end">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" class="text-center">No records found</td></tr>'}
                </tbody>
                <tfoot class="table-secondary">
                    <tr>
                        <th colspan="5" class="text-end">Total:</th>
                        <th class="text-end">${total.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// Generate Voucher Report
async function generateVoucherReport(startDate, endDate) {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/v1/vouchers?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderVoucherReport(data.data);
    }
}

function renderVoucherReport(vouchers) {
    const rows = vouchers.map((v, index) => {
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(v.date).toLocaleDateString()}</td>
                <td>${v.voucherNo || '-'}</td>
                <td>${v.voucherType || '-'}</td>
                <td>${v.narration || '-'}</td>
                <td class="text-end">${(v.totalAmount || 0).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Voucher No</th>
                        <th>Type</th>
                        <th>Narration</th>
                        <th class="text-end">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" class="text-center">No records found</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Expense Report
async function generateExpenseReport(startDate, endDate) {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/v1/expenses?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        currentReportData = data.data;
        renderExpenseReport(data.data);
    }
}

function renderExpenseReport(expenses) {
    let total = 0;
    const rows = expenses.map((exp, index) => {
        total += exp.amount || 0;
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(exp.date).toLocaleDateString()}</td>
                <td>${exp.expenseNo || '-'}</td>
                <td>${exp.head || exp.category || '-'}</td>
                <td>${exp.description || '-'}</td>
                <td class="text-end">${(exp.amount || 0).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('reportContent').innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Expense No</th>
                        <th>Head</th>
                        <th>Description</th>
                        <th class="text-end">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" class="text-center">No records found</td></tr>'}
                </tbody>
                <tfoot class="table-secondary">
                    <tr>
                        <th colspan="5" class="text-end">Total:</th>
                        <th class="text-end">${total.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}
