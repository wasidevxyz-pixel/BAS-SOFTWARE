document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

let itemsList = [];
let customersList = [];
let categoriesList = [];
let returnItems = [];
let editingId = null;
let itemListModal, customerListModal;
let searchIndex = -1;

async function initializePage() {
    document.getElementById('returnDate').valueAsDate = new Date();

    await Promise.all([
        loadCustomers(),
        loadCategories(),
        loadItems(),
        loadReturnList(),
        loadNextReturnNumber()
    ]);

    setupEventListeners();

    // Initialize modals
    itemListModal = new bootstrap.Modal(document.getElementById('itemListModal'));
    customerListModal = new bootstrap.Modal(document.getElementById('customerListModal'));

    // Set user name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) document.getElementById('userName').textContent = user.name;
}

function setupEventListeners() {
    // Row Input calculations
    const rowInputs = ['itemPack', 'itemPrice', 'itemTaxPercent', 'itemIncentive', 'itemDiscPercent'];
    rowInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', calculateRowInput);
    });

    // Summary calculations
    const summaryInputs = ['summaryDiscPercent', 'summaryDiscRs', 'summaryTaxPercent', 'summaryTaxRs', 'summaryMisc', 'summaryFreight', 'summaryPaid'];
    summaryInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateGrandTotals);
    });

    document.getElementById('customerSelect').addEventListener('change', handleCustomerSelect);

    // Item Code (Barcode) Enter handling
    document.getElementById('itemCode').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            if (!query) return;

            const item = itemsList.find(i =>
                (i.barcode && String(i.barcode).trim() === query) ||
                (i.itemsCode && String(i.itemsCode).trim() === query)
            );
            if (item) {
                selectItem(item);
            } else {
                alert('Item not found');
                e.target.select();
            }
        }
    });

    // Item Pack Enter handling
    document.getElementById('itemPack').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItemToTable();
        }
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.position-relative')) {
            document.getElementById('itemSuggestions').style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            openInvoiceSearch();
        }
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveReturn('Posted');
        }
    });

    // Lookup search listeners with category filter
    document.getElementById('itemLookupSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const categoryId = document.getElementById('categorySelect').value;

        const filtered = itemsList.filter(i => {
            const matchesTerm = (i.name && i.name.toLowerCase().includes(term)) ||
                (i.barcode && i.barcode.toLowerCase().includes(term)) ||
                (i.itemsCode && i.itemsCode.toLowerCase().includes(term));

            let matchesCategory = true;
            if (categoryId) {
                matchesCategory = i.category && (
                    (i.category._id && i.category._id === categoryId) ||
                    i.category === categoryId
                );
            }
            return matchesTerm && matchesCategory;
        });
        renderLookupItemList(filtered);
    });

    document.getElementById('customerLookupSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = customersList.filter(c =>
            (c.customerName && c.customerName.toLowerCase().includes(term)) ||
            (c.mobile && c.mobile.toLowerCase().includes(term)) ||
            (c.phone && c.phone.toLowerCase().includes(term)) ||
            (c.code && c.code.toLowerCase().includes(term))
        );
        renderLookupCustomerList(filtered);
    });
}

async function loadCustomers() {
    try {
        const res = await fetch('/api/v1/wh-customers', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            customersList = data.data;
            const select = document.getElementById('customerSelect');
            select.innerHTML = '<option value="">Select Customer</option>';
            customersList.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c._id;
                opt.textContent = c.customerName;
                select.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function loadCategories() {
    try {
        const res = await fetch('/api/v1/wh-item-categories', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            categoriesList = data.data;
            const select = document.getElementById('categorySelect');
            select.innerHTML = '<option value="">Select Category</option>';
            categoriesList.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c._id;
                opt.textContent = c.name;
                select.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function loadItems() {
    try {
        const res = await fetch('/api/v1/wh-items', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            itemsList = data.data;
        }
    } catch (err) { console.error(err); }
}

function filterItems(input) {
    const term = input.value.toLowerCase().trim();
    const suggestions = document.getElementById('itemSuggestions');
    const categoryId = document.getElementById('categorySelect').value;

    if (!term) {
        suggestions.style.display = 'none';
        return;
    }

    const filtered = itemsList.filter(it => {
        const matchesTerm = (it.name && it.name.toLowerCase().includes(term)) ||
            (it.barcode && it.barcode.toLowerCase().includes(term)) ||
            (it.itemsCode && it.itemsCode.toLowerCase().includes(term));

        let matchesCategory = true;
        if (categoryId) {
            matchesCategory = it.category && (
                (it.category._id && it.category._id === categoryId) ||
                it.category === categoryId
            );
        }

        return matchesTerm && matchesCategory;
    }).slice(0, 15);

    if (filtered.length > 0) {
        suggestions.innerHTML = filtered.map((it, idx) => `
            <a href="javascript:void(0)" class="list-group-item list-group-item-action py-1 px-2 small" data-id="${it._id}" onclick="selectItemById('${it._id}')">
                <div class="d-flex justify-content-between">
                    <span>${it.name}</span>
                    <span class="text-muted">${it.barcode || ''}</span>
                </div>
            </a>
        `).join('');
        suggestions.style.display = 'block';
        searchIndex = -1;
        suggestions.matchedItems = filtered;
    } else {
        suggestions.style.display = 'none';
    }
}

function handleItemSearchKeydown(e) {
    const suggestionsBox = document.getElementById('itemSuggestions');
    const items = suggestionsBox.querySelectorAll('.list-group-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        searchIndex = (searchIndex + 1) % items.length;
        updateSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        searchIndex = (searchIndex - 1 + items.length) % items.length;
        updateSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchIndex > -1) {
            const selectedItem = suggestionsBox.matchedItems[searchIndex];
            selectItem(selectedItem);
        } else if (items.length > 0) {
            selectItem(suggestionsBox.matchedItems[0]);
        }
        suggestionsBox.style.display = 'none';
    } else if (e.key === 'Escape') {
        suggestionsBox.style.display = 'none';
    }
}

function updateSelection(items) {
    items.forEach(it => it.classList.remove('active'));
    if (searchIndex > -1) {
        items[searchIndex].classList.add('active');
        items[searchIndex].scrollIntoView({ block: 'nearest' });
    }
}

function selectItemById(id) {
    const item = itemsList.find(it => it._id === id);
    if (item) selectItem(item);
}

function selectItem(item) {
    document.getElementById('itemSelect').value = item._id;
    document.getElementById('itemSearch').value = item.name;
    document.getElementById('itemCode').value = item.barcode || item.itemsCode || '';
    document.getElementById('itemSuggestions').style.display = 'none';
    searchIndex = -1;

    handleItemSelect(item);
    document.getElementById('itemPack').focus();
    document.getElementById('itemPack').select();
}

function handleCustomerSelect() {
    const custId = document.getElementById('customerSelect').value;
    const cust = customersList.find(c => c._id === custId);
    if (cust) {
        document.getElementById('customerPhone').value = cust.mobile || cust.phone || '';
        document.getElementById('summaryPreBalance').value = (cust.openingBalance || 0).toFixed(2);
        updateGrandTotals();
    } else {
        document.getElementById('customerPhone').value = '';
        document.getElementById('summaryPreBalance').value = '0';
    }
}

async function handleItemSelect(localItem) {
    const itemId = localItem ? localItem._id : document.getElementById('itemSelect').value;
    if (!itemId) return;

    // We might have localItem, but we need fresh stock and pricing from API
    try {
        const res = await fetch(`/api/v1/wh-items/${itemId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            const it = data.data;
            const stock = (it.stock && it.stock.length > 0) ? it.stock[0].quantity : 0;
            document.getElementById('itemStock').value = stock;
            if (document.getElementById('footerCurrentStock')) document.getElementById('footerCurrentStock').textContent = stock;

            document.getElementById('itemPrice').value = it.costPrice || 0; // Use costPrice for return too by default, or salePrice? Usually cost for return if it's "Sale Return" coming back to us. But wait, Sale Return means customer returning sold item. Usually returned at "Sale Price".
            // Re-checking wh-sale.js: "itemPrice" defaults to "costPrice"? No wait.
            // In wh-sale.js: document.getElementById('itemPrice').value = data.data.costPrice || 0; 
            // Actually for SALE, we usually use Retail/Sale Price? The user code in wh-sale.js used costPrice??
            // Let's check wh-sale.js line 282: document.getElementById('itemPrice').value = data.data.costPrice || 0; 
            // Wait, Sale is usually at Sale Price. But the user might be using "itemPrice" as the unit price they sell at.
            // If wh-sale.js uses costPrice as default, I will respect that. 
            // BUT, Sale Return should ideally be at the price it was sold.

            // Let's stick to matching wh-sale.js behavior exactly as requested "all function and etc same".
            document.getElementById('itemPrice').value = it.costPrice || 0;
            document.getElementById('itemRetailPrice').value = it.retailPrice || 0;
            document.getElementById('itemIncentive').value = it.incentive || 0;
        }
    } catch (err) { console.error(err); }

    calculateRowInput();
}

function calculateRowInput(e) {
    const pack = parseFloat(document.getElementById('itemPack').value) || 0;
    const price = parseFloat(document.getElementById('itemPrice').value) || 0;
    const taxPer = parseFloat(document.getElementById('itemTaxPercent').value) || 0;
    let incentive = parseFloat(document.getElementById('itemIncentive').value) || 0;
    let discPer = parseFloat(document.getElementById('itemDiscPercent').value) || 0;

    const subTotal = pack * price;
    document.getElementById('itemRowTotal').value = subTotal.toFixed(2);

    const taxRs = (subTotal * taxPer) / 100;
    document.getElementById('itemTaxRs').value = taxRs.toFixed(2);

    const totalWithTax = subTotal + taxRs;
    document.getElementById('itemTotalWithTax').value = totalWithTax.toFixed(2);

    // Incentive/Disc logic from wh-sale.js
    if (!e || e.target.id === 'itemIncentive' || e.target.id === 'itemPack' || e.target.id === 'itemPrice') {
        if (totalWithTax > 0) {
            discPer = ((incentive * pack) / totalWithTax) * 100;
            document.getElementById('itemDiscPercent').value = discPer.toFixed(2);
        }
    }

    const discRs = (totalWithTax * discPer) / 100;
    document.getElementById('itemDiscRs').value = discRs.toFixed(2);

    const netTotal = totalWithTax - discRs;
    document.getElementById('itemNetTotal').value = netTotal.toFixed(2);
}

function addItemToTable() {
    const itemId = document.getElementById('itemSelect').value;
    if (!itemId) return alert('Please select an item');

    const item = itemsList.find(i => i._id === itemId);

    // Edit Check
    const existingIndex = returnItems.findIndex(it => it.item === itemId);
    if (existingIndex > -1) {
        if (confirm(`Item "${item.name}" already exists. Do you want to edit it?`)) {
            returnItems.splice(existingIndex, 1);
            renderTable();
            document.getElementById('itemPack').focus();
            document.getElementById('itemPack').select();
            return;
        } else {
            resetRowInput();
            return;
        }
    }

    const pack = parseFloat(document.getElementById('itemPack').value) || 0;
    if (pack <= 0) return alert('Quantity must be greater than 0');

    const returnItem = {
        item: item._id,
        name: item.name,
        barcode: item.barcode || item.itemsCode || '',
        store: document.getElementById('itemStore').value,
        quantity: pack,
        pcsPrice: parseFloat(document.getElementById('itemPrice').value) || 0,
        retailPrice: parseFloat(document.getElementById('itemRetailPrice').value) || 0,
        subTotal: parseFloat(document.getElementById('itemRowTotal').value) || 0,
        taxPercent: parseFloat(document.getElementById('itemTaxPercent').value) || 0,
        taxAmount: parseFloat(document.getElementById('itemTaxRs').value) || 0,
        totalBeforeIncentive: parseFloat(document.getElementById('itemTotalWithTax').value) || 0, // was totalBeforeDiscount
        incentive: parseFloat(document.getElementById('itemIncentive').value) || 0,
        discountPercent: parseFloat(document.getElementById('itemDiscPercent').value) || 0,
        discountAmount: parseFloat(document.getElementById('itemDiscRs').value) || 0,
        netTotal: parseFloat(document.getElementById('itemNetTotal').value) || 0
    };

    returnItems.push(returnItem);
    renderTable();
    resetRowInput();
    updateGrandTotals();
}

function renderTable() {
    const tbody = document.getElementById('returnTableBody');
    tbody.innerHTML = '';

    let totalPacks = 0, totalSub = 0, totalTax = 0, totalGross = 0, totalIncentive = 0, totalDisc = 0, totalNet = 0;

    returnItems.forEach((it, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td>${it.barcode || ''}</td>
            <td>${it.name || ''}</td>
            <td class="text-end">${it.quantity || 0}</td>
            <td class="text-end">${(it.pcsPrice || 0).toFixed(2)}</td>
            <td class="text-end">${(it.retailPrice || 0).toFixed(2)}</td>
            <td class="text-end">${(it.subTotal || 0).toFixed(2)}</td>
            <td class="text-end">${it.taxPercent || 0}%</td>
            <td class="text-end">${(it.taxAmount || 0).toFixed(2)}</td>
            <td class="text-end">${(it.totalBeforeIncentive || 0).toFixed(2)}</td>
            <td class="text-end">${(it.incentive || 0).toFixed(2)}</td>
            <td class="text-end">${it.discountPercent || 0}%</td>
            <td class="text-end">${(it.discountAmount || 0).toFixed(2)}</td>
            <td class="text-end fw-bold">${(it.netTotal || 0).toFixed(2)}</td>
            <td class="text-center">${it.store || ''}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-danger p-0 px-1" onclick="removeItem(${index})"><i class="fas fa-times"></i></button>
            </td>
        `;
        tbody.appendChild(tr);

        totalPacks += (it.quantity || 0);
        totalSub += (it.subTotal || 0);
        totalTax += (it.taxAmount || 0);
        totalGross += (it.totalBeforeIncentive || 0);
        totalIncentive += (it.incentive || 0);
        totalDisc += (it.discountAmount || 0);
        totalNet += (it.netTotal || 0);
    });

    document.getElementById('footerTotalPack').textContent = totalPacks.toFixed(2);
    document.getElementById('footerTotalSub').textContent = totalSub.toFixed(2);
    document.getElementById('footerTotalTax').textContent = totalTax.toFixed(2);
    document.getElementById('footerTotal').textContent = totalGross.toFixed(2);
    document.getElementById('footerTotalIncentive').textContent = totalIncentive.toFixed(2);
    document.getElementById('footerTotalDisc').textContent = totalDisc.toFixed(2);
    document.getElementById('footerTotalNet').textContent = totalNet.toFixed(2);

    document.getElementById('summaryTotal').value = totalNet.toFixed(2);
    updateGrandTotals();
}

function removeItem(index) {
    returnItems.splice(index, 1);
    renderTable();
}

function resetRowInput() {
    document.getElementById('itemSelect').value = '';
    document.getElementById('itemSearch').value = '';
    document.getElementById('itemCode').value = '';
    document.getElementById('itemPack').value = '1';
    document.getElementById('itemPrice').value = '0';
    document.getElementById('itemRetailPrice').value = '0';
    document.getElementById('itemIncentive').value = '0';
    document.getElementById('itemTaxPercent').value = '0';
    document.getElementById('itemRowTotal').value = '0';
    document.getElementById('itemTaxRs').value = '0';
    document.getElementById('itemTotalWithTax').value = '0';
    document.getElementById('itemDiscPercent').value = '0';
    document.getElementById('itemDiscRs').value = '0';
    document.getElementById('itemNetTotal').value = '0';
    document.getElementById('itemStock').value = '0';
    if (document.getElementById('footerCurrentStock')) document.getElementById('footerCurrentStock').textContent = '0';

    const suggestions = document.getElementById('itemSuggestions');
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    searchIndex = -1;

    document.getElementById('itemCode').focus();
}

function updateGrandTotals() {
    const totalLines = parseFloat(document.getElementById('summaryTotal').value) || 0;

    let discPer = parseFloat(document.getElementById('summaryDiscPercent').value) || 0;
    let discRs = parseFloat(document.getElementById('summaryDiscRs').value) || 0;
    let taxPer = parseFloat(document.getElementById('summaryTaxPercent').value) || 0;
    let taxRs = parseFloat(document.getElementById('summaryTaxRs').value) || 0;
    const misc = parseFloat(document.getElementById('summaryMisc').value) || 0;
    const freight = parseFloat(document.getElementById('summaryFreight').value) || 0;
    const paid = parseFloat(document.getElementById('summaryPaid').value) || 0;
    const preBal = parseFloat(document.getElementById('summaryPreBalance').value) || 0;

    const activeId = document.activeElement ? document.activeElement.id : '';

    if (activeId === 'summaryDiscRs') {
        if (totalLines > 0) {
            discPer = (discRs / totalLines) * 100;
            document.getElementById('summaryDiscPercent').value = discPer.toFixed(2);
        }
    } else {
        discRs = (totalLines * discPer) / 100;
        document.getElementById('summaryDiscRs').value = discRs.toFixed(2);
    }

    const afterDisc = totalLines - discRs;

    if (activeId === 'summaryTaxRs') {
        if (afterDisc > 0) {
            taxPer = (taxRs / afterDisc) * 100;
            document.getElementById('summaryTaxPercent').value = taxPer.toFixed(2);
        }
    } else {
        taxRs = (afterDisc * taxPer) / 100;
        document.getElementById('summaryTaxRs').value = taxRs.toFixed(2);
    }

    const netTotal = afterDisc + taxRs + misc + freight;
    document.getElementById('summaryNetTotal').value = netTotal.toFixed(2);

    const invBal = netTotal - paid;
    document.getElementById('summaryInvBalance').value = invBal.toFixed(2);

    // Return logic: Balance usually DECREASES for customer if they return item (Credit Note).
    // Or if we pay them cash, it balances out.
    // If it's a "Credit" return, we owe them money, reducing their debt (PreBal - InvBal).
    // Let's assume Credit Return: New Balance = Pre Balance - Inv Balance (Total Return Value)
    const newBal = preBal - invBal;
    document.getElementById('summaryNewBalance').value = newBal.toFixed(2);
}

async function saveReturn(status = 'Posted') {
    const customer = document.getElementById('customerSelect').value;
    if (!customer) return alert('Please select a customer');
    if (returnItems.length === 0) return alert('Please add at least one item');

    const returnData = {
        returnNo: document.getElementById('returnNo').value || 'AUTO',
        returnDate: document.getElementById('returnDate').value,
        customer: customer,
        whCategory: document.getElementById('categorySelect').value || null,
        dcNo: document.getElementById('dcNo').value,
        biltyNo: document.getElementById('biltyNo').value,
        transporter: document.getElementById('transporterSelect').value,
        remarks: document.getElementById('remarks').value,
        items: returnItems,
        totalQuantity: parseFloat(document.getElementById('footerTotalPack').textContent),
        totalAmount: parseFloat(document.getElementById('footerTotalNet').textContent), // Note: footerTotalNet is summation of line net totals
        globalDiscountPercent: parseFloat(document.getElementById('summaryDiscPercent').value) || 0,
        globalDiscountAmount: parseFloat(document.getElementById('summaryDiscRs').value) || 0,
        globalTaxPercent: parseFloat(document.getElementById('summaryTaxPercent').value) || 0,
        globalTaxAmount: parseFloat(document.getElementById('summaryTaxRs').value) || 0,
        miscCharges: parseFloat(document.getElementById('summaryMisc').value) || 0,
        freightCharges: parseFloat(document.getElementById('summaryFreight').value) || 0,
        netTotal: parseFloat(document.getElementById('summaryNetTotal').value) || 0,
        paidAmount: parseFloat(document.getElementById('summaryPaid').value) || 0,
        returnBalance: parseFloat(document.getElementById('summaryInvBalance').value) || 0,
        previousBalance: parseFloat(document.getElementById('summaryPreBalance').value) || 0,
        newBalance: parseFloat(document.getElementById('summaryNewBalance').value) || 0,
        payMode: document.getElementById('payMode').value,
        printSize: document.getElementById('printSize').value,
        status: status
    };

    try {
        const url = editingId ? `/api/v1/wh-sale-returns/${editingId}` : '/api/v1/wh-sale-returns';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(returnData)
        });

        const result = await res.json();
        if (result.success) {
            alert('Return saved successfully!');
            const savedId = result.data._id;
            resetForm();
            loadReturnList();
            return savedId;
        } else {
            alert('Error: ' + result.error);
            return null;
        }
    } catch (err) {
        console.error(err);
        return null;
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('returnNo').value = '';
    loadNextReturnNumber();
    document.getElementById('returnDate').valueAsDate = new Date();
    document.getElementById('customerSelect').value = '';
    document.getElementById('categorySelect').value = '';
    document.getElementById('remarks').value = '';
    document.getElementById('dcNo').value = '';
    document.getElementById('biltyNo').value = '';
    document.getElementById('transporterSelect').value = '';
    returnItems = [];
    renderTable();
    resetRowInput();

    ['summaryDiscPercent', 'summaryDiscRs', 'summaryTaxPercent', 'summaryTaxRs', 'summaryMisc', 'summaryFreight', 'summaryPaid', 'summaryInvBalance', 'summaryPreBalance', 'summaryNewBalance'].forEach(id => {
        document.getElementById(id).value = '0';
    });
    document.getElementById('summaryNetTotal').value = '0';
}

async function loadReturnList() {
    try {
        const res = await fetch('/api/v1/wh-sale-returns', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            let rights = user.rights || {};
            if (Object.keys(rights).length === 0) {
                if (user.group && user.group.rights) rights = user.group.rights;
                else if (user.groupId && user.groupId.rights) rights = user.groupId.rights;
            }
            const isAdmin = user.role === 'admin' || (user.group && user.group.isAdmin) || (user.groupId && user.groupId.isAdmin);

            const canEdit = isAdmin || rights['wh_sale_return_edit'];
            const canDelete = isAdmin || rights['wh_sale_return_delete'];
            const canEditPosted = isAdmin || rights['wh_sale_return_edit_posted'];

            const tbody = document.getElementById('returnListBody');
            tbody.innerHTML = data.data.map(r => {
                const showEdit = canEdit || (r.status === 'Posted' && canEditPosted);
                return `
                <tr>
                    <td>${r.returnNo}</td>
                    <td>${new Date(r.returnDate).toLocaleDateString()}</td>
                    <td>${r.customer ? r.customer.customerName : 'N/A'}</td>
                    <td>${r.netTotal.toFixed(2)}</td>
                    <td><span class="badge ${r.status === 'Posted' ? 'bg-success' : 'bg-warning'}">${r.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="printInvoice('${r._id}')"><i class="fas fa-print"></i></button>
                        ${showEdit ? `<button class="btn btn-sm btn-primary ms-1" onclick="editReturn('${r._id}')"><i class="fas fa-edit"></i></button>` : ''}
                        ${canDelete ? `<button class="btn btn-sm btn-danger ms-1" onclick="deleteReturn('${r._id}')"><i class="fas fa-trash"></i></button>` : ''}
                    </td>
                </tr>
            `}).join('');
        }
    } catch (err) { console.error(err); }
}

async function editReturn(id) {
    try {
        const res = await fetch(`/api/v1/wh-sale-returns/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            const r = data.data;
            editingId = r._id;
            switchToDetail();

            document.getElementById('returnNo').value = r.returnNo;
            document.getElementById('returnDate').valueAsDate = new Date(r.returnDate);
            document.getElementById('customerSelect').value = r.customer ? r.customer._id : '';
            handleCustomerSelect();
            document.getElementById('categorySelect').value = r.whCategory ? r.whCategory._id : '';
            document.getElementById('remarks').value = r.remarks || '';
            document.getElementById('dcNo').value = r.dcNo || '';
            document.getElementById('biltyNo').value = r.biltyNo || '';
            document.getElementById('transporterSelect').value = r.transporter || '';

            returnItems = r.items.map(it => ({
                ...it,
                item: it.item._id,
                name: it.item.name || '' // Populate safely
            }));

            renderTable();

            document.getElementById('summaryDiscPercent').value = r.globalDiscountPercent;
            document.getElementById('summaryTaxPercent').value = r.globalTaxPercent;
            document.getElementById('summaryMisc').value = r.miscCharges;
            document.getElementById('summaryFreight').value = r.freightCharges;
            document.getElementById('summaryPaid').value = r.paidAmount;

            updateGrandTotals();
        }
    } catch (err) { console.error(err); }
}

async function deleteReturn(id) {
    if (!confirm('Are you sure you want to delete this return?')) return;
    try {
        const res = await fetch(`/api/v1/wh-sale-returns/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        if (result.success) {
            alert('Return deleted and stock reversed');
            loadReturnList();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (err) { console.error(err); }
}

function switchToList() {
    document.querySelector('.container-fluid').style.display = 'none';
    document.getElementById('listViewContainer').style.display = 'block';
}

function switchToDetail() {
    document.querySelector('.container-fluid').style.display = 'block';
    document.getElementById('listViewContainer').style.display = 'none';
}

function refreshCustomers() { loadCustomers(); }
function refreshItems() { loadItems(); }
function refreshCategories() { loadCategories(); }

function openInvoiceSearch() {
    const inv = prompt("Enter Return Number to search:");
    if (inv) alert("Search for " + inv);
}

function printInvoice(id) {
    if (!id) return;
    window.open(`/wh-print.html?type=sale-return&id=${id}`, '_blank');
}

async function saveAndPrint() {
    const savedId = await saveReturn('Posted');
    if (savedId) {
        printInvoice(savedId);
    }
}

// LOOKUP FUNCTIONS
function showItemLookup() {
    const categoryId = document.getElementById('categorySelect').value;
    let items = itemsList;
    if (categoryId) {
        items = itemsList.filter(it => it.category && (
            (it.category._id && it.category._id === categoryId) ||
            it.category === categoryId
        ));
    }
    renderLookupItemList(items);
    itemListModal.show();
    setTimeout(() => document.getElementById('itemLookupSearch').focus(), 500);
}

function renderLookupItemList(items) {
    const tbody = document.getElementById('itemLookupBody');
    tbody.innerHTML = items.map(it => `
        <tr>
            <td><button class="btn btn-sm btn-primary" onclick="selectLookupItem('${it._id}')">Select</button></td>
            <td>${it.barcode || it.itemsCode || ''}</td>
            <td>${it.name}</td>
            <td>${(it.retailPrice || 0).toFixed(2)}</td>
            <td>${(it.costPrice || 0).toFixed(2)}</td>
            <td>${(it.stock && it.stock.length > 0) ? it.stock[0].quantity : 0}</td>
            <td>${it.category ? it.category.name : ''}</td>
            <td>${it.supplier ? it.supplier.supplierName : ''}</td>
        </tr>
    `).join('');
}

function selectLookupItem(id) {
    const item = itemsList.find(it => it._id === id);
    if (item) selectItem(item);
    itemListModal.hide();
}

function showCustomerLookup() {
    renderLookupCustomerList(customersList);
    customerListModal.show();
    setTimeout(() => document.getElementById('customerLookupSearch').focus(), 500);
}

function renderLookupCustomerList(customers) {
    const tbody = document.getElementById('customerLookupBody');
    tbody.innerHTML = customers.map(c => `
        <tr>
            <td><button class="btn btn-sm btn-primary" onclick="selectLookupCustomer('${c._id}')">Select</button></td>
            <td>${c.code || ''}</td>
            <td>${c.customerName}</td>
            <td>${c.mobile || c.phone || ''}</td>
            <td>${(c.openingBalance || 0).toFixed(2)}</td>
            <td>${c.category ? c.category.name : ''}</td>
        </tr>
    `).join('');
}

function selectLookupCustomer(id) {
    document.getElementById('customerSelect').value = id;
    handleCustomerSelect();
    customerListModal.hide();
}

async function loadNextReturnNumber() {
    if (editingId) return; // Don't overwrite when editing
    try {
        const res = await fetch('/api/v1/wh-sale-returns/next-number', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        if (result.success) {
            document.getElementById('returnNo').value = result.data;
        }
    } catch (error) {
        console.error('Error loading next return number:', error);
    }
}
