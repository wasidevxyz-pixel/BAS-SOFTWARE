document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

let itemsList = [];
let customersList = [];
let categoriesList = [];
let saleItems = []; // Array of items added to the table
let editingId = null;
let itemListModal, customerListModal;
let searchIndex = -1;
let customerSearchIndex = -1;

async function initializePage() {
    document.getElementById('invoiceDate').valueAsDate = new Date();

    // Set default dates for list
    const today = new Date();
    // const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('listFromDate').valueAsDate = today;
    document.getElementById('listToDate').valueAsDate = today;

    await Promise.all([
        loadCustomers(),
        loadCategories(),
        loadItems(),
        loadSaleList(),
        loadNextInvoiceNumber()
    ]);

    // Setup Event Listeners
    setupEventListeners();

    // Initialize modals
    itemListModal = new bootstrap.Modal(document.getElementById('itemListModal'));
    customerListModal = new bootstrap.Modal(document.getElementById('customerListModal'));

    // Set user name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) document.getElementById('userName').textContent = user.name;
}

async function loadNextInvoiceNumber() {
    if (editingId) return; // Don't overwrite when editing
    try {
        const res = await fetch('/api/v1/wh-sales/next-number', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        if (result.success) {
            document.getElementById('invoiceNo').value = result.data;
        }
    } catch (error) {
        console.error('Error loading next invoice number:', error);
    }
}

function setupEventListeners() {
    // Row Input calculations
    const rowInputs = ['itemPack', 'itemPrice', 'itemTaxPercent', 'itemIncentive', 'itemDiscPercent'];
    rowInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', calculateRowInput);
    });

    // Summary calculations
    const summaryInputs = ['summaryDiscPercent', 'summaryDiscRs', 'summaryTaxPercent', 'summaryTaxRs', 'summaryMisc', 'summaryPaid'];
    summaryInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateGrandTotals);
    });

    // Item Selection
    // document.getElementById('itemSelect').addEventListener('change', handleItemSelect); 
    // Commented out since we call it manually in selectItem

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.position-relative')) {
            document.getElementById('itemSuggestions').style.display = 'none';
            document.getElementById('customerSuggestions').style.display = 'none';
        }
    });
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


    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            openInvoiceSearch();
        }
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveSale('Posted');
        }
    });

    // Lookup search listeners
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

    // List Search Enter key handling (kept for legacy/backup)
    document.getElementById('listSearch').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadSaleList();
        }
    });

    // Auto Search on Input
    let searchDebounce;
    document.getElementById('listSearch').addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(loadSaleList, 300);
    });
}

async function loadCustomers() {
    try {
        const res = await fetch('/api/v1/wh-customers', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            let customers = data.data;
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (user && user.allowedWHCustomerCategories && user.allowedWHCustomerCategories.length > 0) {
                const allowed = user.allowedWHCustomerCategories;
                customers = customers.filter(c => {
                    const catId = typeof c.customerCategory === 'object' ? c.customerCategory?._id : c.customerCategory;
                    return allowed.includes(catId);
                });
            }
            customersList = customers;
        }
    } catch (err) { console.error(err); }
}

function filterCustomers(input) {
    const term = input.value.toLowerCase().trim();
    const suggestions = document.getElementById('customerSuggestions');

    if (!term) {
        suggestions.style.display = 'none';
        return;
    }

    const filtered = customersList.filter(c =>
        (c.customerName && c.customerName.toLowerCase().includes(term)) ||
        (c.mobile && c.mobile.includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.code && c.code.toLowerCase().includes(term))
    ).slice(0, 15);

    if (filtered.length > 0) {
        suggestions.innerHTML = filtered.map((c, idx) => `
            <a href="javascript:void(0)" class="list-group-item list-group-item-action py-1 px-2 small" onclick="selectCustomerById('${c._id}')">
                <div class="d-flex justify-content-between">
                    <span>${c.customerName}</span>
                    <span class="text-muted small">${c.mobile || c.phone || ''}</span>
                </div>
            </a>
        `).join('');
        suggestions.style.display = 'block';
        customerSearchIndex = -1;
        suggestions.matchedItems = filtered;
    } else {
        suggestions.style.display = 'none';
    }
}

function handleCustomerSearchKeydown(e) {
    const suggestionsBox = document.getElementById('customerSuggestions');
    const items = suggestionsBox.querySelectorAll('.list-group-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        customerSearchIndex = (customerSearchIndex + 1) % items.length;
        updateCustomerSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        customerSearchIndex = (customerSearchIndex - 1 + items.length) % items.length;
        updateCustomerSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (customerSearchIndex > -1) {
            const selected = suggestionsBox.matchedItems[customerSearchIndex];
            selectCustomer(selected);
        } else if (items.length > 0) {
            selectCustomer(suggestionsBox.matchedItems[0]);
        }
        suggestionsBox.style.display = 'none';
    } else if (e.key === 'Escape') {
        suggestionsBox.style.display = 'none';
    }
}

function updateCustomerSelection(items) {
    items.forEach(it => it.classList.remove('active'));
    if (customerSearchIndex > -1) {
        items[customerSearchIndex].classList.add('active');
        items[customerSearchIndex].scrollIntoView({ block: 'nearest' });
    }
}

function selectCustomerById(id) {
    const cust = customersList.find(c => c._id === id);
    if (cust) selectCustomer(cust);
}

function selectCustomer(cust) {
    document.getElementById('customerSelect').value = cust._id;
    document.getElementById('customerSearch').value = cust.customerName;
    document.getElementById('customerPhone').value = cust.mobile || cust.phone || '';
    document.getElementById('summaryPreBalance').value = (cust.openingBalance || 0).toFixed(2);
    document.getElementById('customerSuggestions').style.display = 'none';
    customerSearchIndex = -1;
    updateGrandTotals();
    document.getElementById('itemCode').focus();
}

async function loadCategories() {
    try {
        const res = await fetch('/api/v1/wh-item-categories', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const allowed = (user && user.allowedWHItemCategories && user.allowedWHItemCategories.length > 0) ? user.allowedWHItemCategories : null;

            categoriesList = data.data;
            const select = document.getElementById('categorySelect');
            select.innerHTML = '<option value="">Select Category</option>';
            categoriesList.forEach(c => {
                if (!allowed || allowed.includes(c._id)) {
                    const opt = document.createElement('option');
                    opt.value = c._id;
                    opt.textContent = c.name;
                    select.appendChild(opt);
                }
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
            let items = data.data;
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (user && user.allowedWHItemCategories && user.allowedWHItemCategories.length > 0) {
                const allowed = user.allowedWHItemCategories;
                items = items.filter(it => {
                    const catId = typeof it.category === 'object' ? it.category?._id : it.category;
                    return allowed.includes(catId);
                });
            }
            itemsList = items;
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
            // Check if category matches (handle object with _id or direct ID string)
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
        const query = e.target.value.trim();
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
    document.getElementById('itemSuggestions').style.display = 'none';
    searchIndex = -1; // Reset search selection
    handleItemSelect();
    document.getElementById('itemPack').focus();
    document.getElementById('itemPack').select();
}

function handleCustomerSelect() {
    // This is now handled by selectCustomer
}

async function handleItemSelect() {
    const itemId = document.getElementById('itemSelect').value;
    const item = itemsList.find(i => i._id === itemId);
    if (item) {
        // Initial population from cached list
        document.getElementById('itemCode').value = item.barcode || item.itemsCode || '';
        document.getElementById('itemPrice').value = item.costPrice || 0;
        document.getElementById('itemRetailPrice').value = item.retailPrice || 0;
        document.getElementById('itemIncentive').value = item.incentive || 0;
        document.getElementById('itemStock').value = (item.stock && item.stock.length > 0) ? item.stock[0].quantity : 0;
        if (document.getElementById('footerCurrentStock')) document.getElementById('footerCurrentStock').textContent = document.getElementById('itemStock').value;

        // Load LATEST data from API (in case of updates)
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

                // Only overwrite if API returns a value (avoid wiping out cached data with 0 if API is inconsistent)
                if (it.costPrice !== undefined) document.getElementById('itemPrice').value = it.costPrice;
                if (it.retailPrice !== undefined) document.getElementById('itemRetailPrice').value = it.retailPrice;
                if (it.incentive !== undefined) document.getElementById('itemIncentive').value = it.incentive;
                if (it.barcode || it.itemsCode) document.getElementById('itemCode').value = it.barcode || it.itemsCode;
            }
        } catch (err) { console.error('Error fetching latest item data:', err); }

        calculateRowInput();
    }
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

    // If incentive, pack or price changed, calculate Disc% (Against Incentive logic)
    // Also calculate on initial load (e is undefined)
    if (!e || e.target.id === 'itemIncentive' || e.target.id === 'itemPack' || e.target.id === 'itemPrice') {
        if (totalWithTax > 0) {
            discPer = ((incentive * pack) / totalWithTax) * 100;
            document.getElementById('itemDiscPercent').value = discPer.toFixed(2);
        }
    }
    // If Disc% changed, it calculates Disc Rs

    const discRs = (totalWithTax * discPer) / 100;
    document.getElementById('itemDiscRs').value = discRs.toFixed(2);

    // RS VALUE ALSO CALCULATE ACCOURDING TO QTY
    // NetTotal = TotalWithTax - Discount (which accounts for incentive if linked)
    // If incentive and discount are separate:
    // netTotal = totalWithTax - discRs - (incentive * pack); 
    // But since "DISC PERCENTAGE ALSO CALCULATE AGT INCENTIVE", 
    // manually subtracted incentive might be redundant if discRs already includes it.

    // Let's stick to: discRs is the total discount (calculated from discPer which can be based on incentive)
    const netTotal = totalWithTax - discRs;
    document.getElementById('itemNetTotal').value = netTotal.toFixed(2);
}

function addItemToTable() {
    const itemId = document.getElementById('itemSelect').value;
    if (!itemId) return alert('Please select an item');

    const item = itemsList.find(i => i._id === itemId);

    // Check duplicates
    const existingIndex = saleItems.findIndex(it => it.item === itemId);
    if (existingIndex > -1) {
        if (confirm(`Item "${item.name}" already exists in the list. Do you want to edit it?`)) {
            // Remove from list and keep in input to "edit"
            saleItems.splice(existingIndex, 1);
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

    // Stock Check
    const currentStock = parseFloat(document.getElementById('itemStock').value) || 0;
    if (pack > currentStock) {
        return alert(`Insufficient Stock! Available: ${currentStock}`);
    }

    const saleItem = {
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
        totalBeforeIncentive: parseFloat(document.getElementById('itemTotalWithTax').value) || 0,
        incentive: parseFloat(document.getElementById('itemIncentive').value) || 0,
        discountPercent: parseFloat(document.getElementById('itemDiscPercent').value) || 0,
        discountAmount: parseFloat(document.getElementById('itemDiscRs').value) || 0,
        netTotal: parseFloat(document.getElementById('itemNetTotal').value) || 0
    };

    saleItems.push(saleItem);
    renderTable();
    resetRowInput();
}

function renderTable() {
    const tbody = document.getElementById('saleTableBody');
    tbody.innerHTML = '';

    let totalPacks = 0, totalSub = 0, totalTax = 0, totalGross = 0, totalIncentive = 0, totalDisc = 0, totalNet = 0;

    saleItems.forEach((it, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td>${it.barcode || ''}</td>
            <td>${it.name || ''}</td>
            <td class="text-end">${it.quantity || 0}</td>
            <td class="text-end">${(it.pcsPrice || 0).toFixed(2)}</td>
            <td class="text-end">${(it.retailPrice || 0).toFixed(2)}</td>
            <td class="text-end">${(it.subTotal || 0).toFixed(2)}</td>
            <td class="text-end">${(it.taxPercent || 0)}%</td>
            <td class="text-end">${(it.taxAmount || 0).toFixed(2)}</td>
            <td class="text-end">${(it.totalBeforeIncentive || 0).toFixed(2)}</td>
            <td class="text-end">${(it.incentive || 0).toFixed(2)}</td>
            <td class="text-end">${(it.discountPercent || 0)}%</td>
            <td class="text-end">${(it.discountAmount || 0).toFixed(2)}</td>
            <td class="text-end fw-bold">${(it.netTotal || 0).toFixed(2)}</td>
            <td class="text-center">${it.store || ''}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-primary p-0 px-1 me-1" onclick="editItem(${index})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger p-0 px-1" style="background-color: red !important; border-color: red !important;" onclick="removeItem(${index})"><i class="fas fa-times"></i></button>
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
    saleItems.splice(index, 1);
    renderTable();
    updateGrandTotals();
}

async function editItem(index) {
    const item = saleItems[index];

    // Remove from array and update table
    saleItems.splice(index, 1);
    renderTable();
    updateGrandTotals();

    // Set item selection
    document.getElementById('itemSelect').value = item.item;
    document.getElementById('itemSearch').value = item.name;

    // Trigger Item Select Logic
    await handleItemSelect();

    // Restore User Values
    document.getElementById('itemPack').value = item.quantity;
    document.getElementById('itemPrice').value = item.pcsPrice;
    document.getElementById('itemRetailPrice').value = item.retailPrice;
    document.getElementById('itemTaxPercent').value = item.taxPercent;
    document.getElementById('itemIncentive').value = item.incentive;
    document.getElementById('itemDiscPercent').value = item.discountPercent;
    if (item.store) document.getElementById('itemStore').value = item.store;

    // Recalculate totals based on restored values
    calculateRowInput();

    // Focus for editing
    document.getElementById('itemPack').focus();
    document.getElementById('itemPack').select();
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
    if (document.getElementById('footerCurrentStock')) document.getElementById('footerCurrentStock').textContent = '0';

    // Clear and hide suggestions
    const suggestions = document.getElementById('itemSuggestions');
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    searchIndex = -1;

    document.getElementById('itemCode').focus();
}

function updateGrandTotals() {
    const totalLinesVal = document.getElementById('summaryTotal').value;
    const totalLines = parseFloat(totalLinesVal) || 0;

    let discPer = parseFloat(document.getElementById('summaryDiscPercent').value) || 0;
    let discRs = parseFloat(document.getElementById('summaryDiscRs').value) || 0;
    let taxPer = parseFloat(document.getElementById('summaryTaxPercent').value) || 0;
    let taxRs = parseFloat(document.getElementById('summaryTaxRs').value) || 0;
    const misc = parseFloat(document.getElementById('summaryMisc').value) || 0;
    const paid = parseFloat(document.getElementById('summaryPaid').value) || 0;
    const preBal = parseFloat(document.getElementById('summaryPreBalance').value) || 0;

    const activeId = document.activeElement ? document.activeElement.id : '';

    // Discount Calculation
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

    // Tax Calculation
    if (activeId === 'summaryTaxRs') {
        if (afterDisc > 0) {
            taxPer = (taxRs / afterDisc) * 100;
            document.getElementById('summaryTaxPercent').value = taxPer.toFixed(2);
        }
    } else {
        taxRs = (afterDisc * taxPer) / 100;
        document.getElementById('summaryTaxRs').value = taxRs.toFixed(2);
    }

    const netTotal = afterDisc + taxRs + misc;
    document.getElementById('summaryNetTotal').value = netTotal.toFixed(2);

    const invBal = netTotal - paid;
    document.getElementById('summaryInvBalance').value = invBal.toFixed(2);

    const newBal = preBal + invBal;
    document.getElementById('summaryNewBalance').value = newBal.toFixed(2);
}

async function saveSale(status = 'Posted') {
    const customer = document.getElementById('customerSelect').value;
    if (!customer) return alert('Please select a customer');
    if (saleItems.length === 0) return alert('Please add at least one item');

    const saleData = {
        invoiceNo: document.getElementById('invoiceNo').value || 'AUTO',
        invoiceDate: document.getElementById('invoiceDate').value,
        customer: customer,
        remarks: document.getElementById('remarks').value,
        whCategory: document.getElementById('categorySelect').value || null,
        items: saleItems,
        totalQuantity: parseFloat(document.getElementById('footerTotalPack').textContent),
        totalAmount: parseFloat(document.getElementById('footerTotalNet').textContent),
        globalDiscountPercent: parseFloat(document.getElementById('summaryDiscPercent').value) || 0,
        globalDiscountAmount: parseFloat(document.getElementById('summaryDiscRs').value) || 0,
        globalTaxPercent: parseFloat(document.getElementById('summaryTaxPercent').value) || 0,
        globalTaxAmount: parseFloat(document.getElementById('summaryTaxRs').value) || 0,
        miscCharges: parseFloat(document.getElementById('summaryMisc').value) || 0,
        netTotal: parseFloat(document.getElementById('summaryNetTotal').value) || 0,
        paidAmount: parseFloat(document.getElementById('summaryPaid').value) || 0,
        invoiceBalance: parseFloat(document.getElementById('summaryInvBalance').value) || 0,
        previousBalance: parseFloat(document.getElementById('summaryPreBalance').value) || 0,
        newBalance: parseFloat(document.getElementById('summaryNewBalance').value) || 0,
        payMode: document.getElementById('payMode').value,
        printSize: document.getElementById('printSize').value,
        status: status
    };

    try {
        const url = editingId ? `/api/v1/wh-sales/${editingId}` : '/api/v1/wh-sales';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(saleData)
        });

        const result = await res.json();
        if (result.success) {
            alert('Sale saved successfully!');
            const savedId = result.data._id;
            resetForm();
            loadSaleList();
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
    document.getElementById('invoiceNo').value = '';
    loadNextInvoiceNumber();
    document.getElementById('invoiceDate').valueAsDate = new Date();
    document.getElementById('customerSelect').value = '';
    document.getElementById('remarks').value = '';
    document.getElementById('categorySelect').value = '';
    saleItems = [];
    renderTable();
    resetRowInput();

    // Reset summary
    ['summaryDiscPercent', 'summaryDiscRs', 'summaryTaxPercent', 'summaryTaxRs', 'summaryMisc', 'summaryPaid', 'summaryInvBalance', 'summaryPreBalance', 'summaryNewBalance'].forEach(id => {
        document.getElementById(id).value = '0';
    });
    document.getElementById('summaryNetTotal').value = '0';
    document.getElementById('customerSearch').value = '';
    document.getElementById('customerPhone').value = '';
}

async function loadSaleList() {
    try {
        const fromDate = document.getElementById('listFromDate').value;
        const toDate = document.getElementById('listToDate').value;
        const search = document.getElementById('listSearch').value.toLowerCase();

        let url = `/api/v1/wh-sales?startDate=${fromDate}&endDate=${toDate}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            let sales = data.data;

            // Extra frontend filter for customer name if search is provided
            if (search) {
                sales = sales.filter(s =>
                    (s.invoiceNo && s.invoiceNo.toLowerCase().includes(search)) ||
                    (s.customer && s.customer.customerName && s.customer.customerName.toLowerCase().includes(search)) ||
                    (s.remarks && s.remarks.toLowerCase().includes(search))
                );
            }

            // Filter by allowed categories
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (user && user.allowedWHCustomerCategories && user.allowedWHCustomerCategories.length > 0) {
                const allowed = user.allowedWHCustomerCategories;
                sales = sales.filter(s => {
                    if (!s.customer) return false;
                    const catId = typeof s.customer.customerCategory === 'object' ? s.customer.customerCategory?._id : s.customer.customerCategory;
                    return allowed.includes(catId);
                });
            }

            const rights = user.rights || {};
            if (Object.keys(rights).length === 0) {
                if (user.group && user.group.rights) rights = user.group.rights;
                else if (user.groupId && user.groupId.rights) rights = user.groupId.rights;
            }
            const isAdmin = user.role === 'admin' || (user.group && user.group.isAdmin) || (user.groupId && user.groupId.isAdmin);

            const canEdit = isAdmin || rights['wh_sale_edit'];
            const canDelete = isAdmin || rights['wh_sale_delete'];
            const canEditPosted = isAdmin || rights['wh_sale_edit_posted'];

            const tbody = document.getElementById('saleListBody');
            tbody.innerHTML = sales.map(s => {
                const showEdit = canEdit || (s.status === 'Posted' && canEditPosted);
                return `
                <tr>
                    <td>${s.invoiceNo}</td>
                    <td>${new Date(s.invoiceDate).toLocaleDateString()}</td>
                    <td>${s.customer ? s.customer.customerName : 'N/A'}</td>
                    <td>${s.netTotal.toFixed(2)}</td>
                    <td>${s.paidAmount.toFixed(2)}</td>
                    <td>${s.invoiceBalance.toFixed(2)}</td>
                    <td><span class="badge ${s.status === 'Posted' ? 'bg-success' : 'bg-warning'}">${s.status}</span></td>
                    <td>${s.createdBy ? s.createdBy.name : 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-info text-white" title="Print" onclick="printInvoice('${s._id}')"><i class="fas fa-print"></i></button>
                        ${showEdit ? `<button class="btn btn-sm btn-primary ms-1" title="Edit" onclick="editSale('${s._id}')"><i class="fas fa-edit"></i></button>` : ''}
                        ${canDelete ? `<button class="btn btn-sm btn-danger ms-1" title="Delete" onclick="deleteSale('${s._id}')"><i class="fas fa-trash"></i></button>` : ''}
                    </td>
                </tr>
            `}).join('');
        }
    } catch (err) { console.error(err); }
}

async function editSale(id) {
    try {
        const res = await fetch(`/api/v1/wh-sales/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
            const s = data.data;
            editingId = s._id;

            switchToDetail();

            document.getElementById('invoiceNo').value = s.invoiceNo;
            document.getElementById('invoiceDate').valueAsDate = new Date(s.invoiceDate);

            // Handle Customer Selection
            if (s.customer) {
                selectCustomerById(s.customer._id);
            }

            document.getElementById('remarks').value = s.remarks || '';
            document.getElementById('categorySelect').value = s.whCategory ? s.whCategory._id : '';

            saleItems = s.items.map(it => ({
                ...it,
                item: it.item._id,
                name: it.item.name
            }));

            renderTable();

            document.getElementById('summaryDiscPercent').value = s.globalDiscountPercent;
            document.getElementById('summaryTaxPercent').value = s.globalTaxPercent;
            document.getElementById('summaryMisc').value = s.miscCharges;
            document.getElementById('summaryPaid').value = s.paidAmount;

            updateGrandTotals();
        }
    } catch (err) { console.error(err); }
}

async function deleteSale(id) {
    if (!confirm('Are you sure you want to delete this sale?')) return;
    try {
        const res = await fetch(`/api/v1/wh-sales/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        if (result.success) {
            alert('Sale deleted and stock reversed');
            loadSaleList();
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
    const inv = prompt("Enter Invoice Number to search:");
    if (inv) {
        // Logic to search and load
        alert("Search for " + inv);
    }
}

function printInvoice(id) {
    if (!id) return;
    window.open(`/wh-print.html?type=sale&id=${id}`, '_blank');
}

async function saveAndPrint() {
    const savedId = await saveSale('Posted');
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
            <td>${it.retailPrice.toFixed(2)}</td>
            <td>${it.costPrice.toFixed(2)}</td>
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
    selectCustomerById(id);
    customerListModal.hide();
}
