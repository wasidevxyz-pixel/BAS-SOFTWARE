document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

let selectedCustomer = null;
let currentEditId = null;
const token = localStorage.getItem('token');

async function initializePage() {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const lastDec31 = new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('filterFrom').value = lastDec31;
    document.getElementById('filterTo').value = today;

    // Load initial data
    await loadCustomers();
    await loadPayments();
    await loadCashInHand();


    // Shortcut Key: Alt + S for Save
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            document.getElementById('paymentForm').requestSubmit();
        }
    });

    // Event listeners
    document.getElementById('customer').addEventListener('change', handleCustomerChange);
    document.getElementById('amount').addEventListener('input', calculateBalance);
    document.getElementById('discountPercent').addEventListener('input', calculateBalance);
    document.getElementById('discountAmount').addEventListener('input', calculateBalance);
    document.getElementById('paymentMode').addEventListener('change', handlePaymentModeChange);
    document.getElementById('paymentType').addEventListener('change', calculateBalance);

    document.getElementById('paymentForm').addEventListener('submit', handleSave);

    // Filter listener
    document.getElementById('filterSearch').addEventListener('input', debounce(loadPayments, 500));
}


async function loadCustomers() {
    try {
        const response = await fetch('/api/v1/wh-customers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const select = document.getElementById('customer');
        const currentValue = select.value;

        select.innerHTML = '<option value="">Select Customer</option>';
        if (data.success) {
            data.data.forEach(cust => {
                const option = document.createElement('option');
                option.value = cust._id;
                option.textContent = `${cust.customerName} (${cust.code})`;
                option.dataset.balance = cust.openingBalance || 0;
                select.appendChild(option);
            });
            if (currentValue) {
                select.value = currentValue;
                // Manually trigger the balance update to show the new balance from DB
                handleCustomerChange({ target: select });
            }
        }

    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

function handleCustomerChange(e) {
    const option = e.target.options[e.target.selectedIndex];
    if (option && option.value) {
        const balance = parseFloat(option.dataset.balance || 0);
        document.getElementById('previousBalance').value = balance;
        calculateBalance();
    } else {
        document.getElementById('previousBalance').value = 0;
        document.getElementById('balance').value = 0;
    }
}

function calculateBalance() {
    const preBalance = parseFloat(document.getElementById('previousBalance').value || 0);
    const amount = parseFloat(document.getElementById('amount').value || 0);
    const discPercent = parseFloat(document.getElementById('discountPercent').value || 0);
    const paymentType = document.getElementById('paymentType').value;

    let discAmount = parseFloat(document.getElementById('discountAmount').value || 0);

    // If discount percent changed, update discount amount
    // If discount amount changed manually, we don't update percent here to avoid loops
    // In this simple implementation, we'll favor percent if it's > 0
    if (discPercent > 0) {
        discAmount = (amount * discPercent) / 100;
        document.getElementById('discountAmount').value = discAmount.toFixed(2);
    }

    let newBalance = preBalance;
    if (paymentType === 'Received') {
        newBalance = preBalance - (amount + discAmount);
    } else {
        newBalance = preBalance + (amount + discAmount);
    }

    document.getElementById('balance').value = newBalance.toFixed(2);
}

function handlePaymentModeChange(e) {
    const mode = e.target.value;
    const bankInfo = document.getElementById('bankInfo');
    if (mode !== 'Cash') {
        bankInfo.classList.remove('d-none');
    } else {
        bankInfo.classList.add('d-none');
    }
}

async function handleSave(e) {
    e.preventDefault();

    const formData = {
        paymentType: document.getElementById('paymentType').value,
        date: document.getElementById('date').value,
        customer: document.getElementById('customer').value,
        previousBalance: parseFloat(document.getElementById('previousBalance').value),
        amount: parseFloat(document.getElementById('amount').value),
        discountPercent: parseFloat(document.getElementById('discountPercent').value || 0),
        discountAmount: parseFloat(document.getElementById('discountAmount').value || 0),
        paymentMode: document.getElementById('paymentMode').value,
        bankName: document.getElementById('bankName').value,
        remarks: document.getElementById('remarks').value
    };

    try {
        const url = currentEditId ? `/api/v1/wh-customer-payments/${currentEditId}` : '/api/v1/wh-customer-payments';
        const method = currentEditId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (data.success) {
            alert('Payment voucher saved successfully!');
            resetForm();
            loadPayments();
            loadCustomers();
            loadCashInHand();
        }
        else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error saving payment:', error);
        alert('Failed to save payment');
    }
}

async function loadPayments() {
    const from = document.getElementById('filterFrom').value;
    const to = document.getElementById('filterTo').value;
    const search = document.getElementById('filterSearch').value;

    let url = `/api/v1/wh-customer-payments?from=${from}&to=${to}`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const tbody = document.getElementById('paymentsBody');
        tbody.innerHTML = '';

        let totalAmount = 0;
        let totalDisc = 0;

        if (data.success) {
            let filteredData = data.data;
            if (search) {
                const s = search.toLowerCase();
                filteredData = filteredData.filter(p =>
                    (p.customer && p.customer.customerName.toLowerCase().includes(s)) ||
                    (p.receiptNo && p.receiptNo.toLowerCase().includes(s))
                );
            }

            filteredData.forEach(p => {
                totalAmount += p.amount || 0;
                totalDisc += p.discountAmount || 0;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.receiptNo}</td>
                    <td>${new Date(p.date).toLocaleDateString()}</td>
                    <td>${p.customer ? p.customer.customerName : 'N/A'}</td>
                    <td><span class="badge ${p.paymentType === 'Received' ? 'bg-success' : 'bg-danger'}">${p.paymentType}</span></td>
                    <td class="text-end">${p.previousBalance.toFixed(2)}</td>
                    <td class="text-end fw-bold text-primary">${p.amount.toFixed(2)}</td>
                    <td class="text-end text-danger">${p.discountAmount.toFixed(2)}</td>
                    <td class="text-end fw-bold">${p.balance.toFixed(2)}</td>
                    <td>${p.paymentMode}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="editPayment('${p._id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-info" onclick="printVoucher('${p._id}')" title="Print">
                                <i class="fas fa-print"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="deletePayment('${p._id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById('totalAmountSum').textContent = totalAmount.toFixed(2);
            document.getElementById('totalDiscountSum').textContent = totalDisc.toFixed(2);
        }
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

async function editPayment(id) {
    try {
        const response = await fetch(`/api/v1/wh-customer-payments/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const p = data.data;
            currentEditId = id;
            document.getElementById('paymentId').value = id;
            document.getElementById('paymentType').value = p.paymentType;
            document.getElementById('date').value = p.date.split('T')[0];
            document.getElementById('customer').value = p.customer._id || p.customer;
            document.getElementById('previousBalance').value = p.previousBalance;
            document.getElementById('amount').value = p.amount;
            document.getElementById('discountPercent').value = p.discountPercent;
            document.getElementById('discountAmount').value = p.discountAmount;
            document.getElementById('balance').value = p.balance;
            document.getElementById('paymentMode').value = p.paymentMode;
            document.getElementById('bankName').value = p.bankName || '';
            document.getElementById('remarks').value = p.remarks || '';

            handlePaymentModeChange({ target: { value: p.paymentMode } });

            // UI Update
            document.getElementById('btnSave').innerHTML = '<i class="fas fa-check me-1"></i>UPDATE';
        }

    } catch (error) {
        console.error('Error editing payment:', error);
    }
}

async function deletePayment(id) {
    if (!confirm('Are you sure you want to delete this payment voucher?')) return;
    try {
        const response = await fetch(`/api/v1/wh-customer-payments/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            alert('Voucher deleted');
            loadPayments();
            loadCustomers();
            loadCashInHand();
        }

    } catch (error) {
        console.error('Error deleting payment:', error);
    }
}

async function loadCashInHand() {
    try {
        // Using existing cash transactions summary if available
        const response = await fetch('/api/v1/cash-transactions/summary', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('cashInHand').textContent = data.data.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 });
        }
    } catch (error) {
        console.error('Error loading cash in hand:', error);
    }
}

function resetForm() {
    currentEditId = null;
    document.getElementById('paymentId').value = '';
    document.getElementById('paymentForm').reset();
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    document.getElementById('btnSave').innerHTML = '<i class="fas fa-save me-1"></i>SAVE';
    document.getElementById('bankInfo').classList.add('d-none');
    document.getElementById('previousBalance').value = 0;
    document.getElementById('balance').value = 0;
}

function printVoucher(id) {
    const voucherId = id || currentEditId;
    if (!voucherId) {
        alert('Please save the voucher first or select one from the list');
        return;
    }
    const url = `/print-invoice.html?type=wh-customer-payment&id=${voucherId}`;
    window.open(url, '_blank');
}

async function syncBalance() {
    const customerId = document.getElementById('customer').value;
    if (!customerId) return alert('Please select a customer first');

    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const res = await fetch(`/api/v1/wh-customers/${customerId}/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            alert('Balance synced successfully');
            await loadCustomers(); // Re-fetch all customers to get the new balance
        } else {
            alert(data.message || 'Error syncing balance');
        }
    } catch (err) {
        console.error(err);
        alert('Connection error');
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}
function viewLedger() {
    const customerId = document.getElementById('customer').value;
    if (!customerId) return alert('Please select a customer first');
    window.location.href = `/wh-customer-ledger-report.html?id=${customerId}`;
}


// Helper: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
