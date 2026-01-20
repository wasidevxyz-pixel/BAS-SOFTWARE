# WH Purchase Return - JavaScript Changes Required

## Critical Changes to Make in `wh-purchase-return.js`:

### 1. Update Field IDs (Find & Replace):
- `invoiceNo` → `returnNo`
- `invoiceDate` → `returnDate`
- `purchaseId` → `returnId`
- `savePurchase` → `saveReturn`
- `editPurchase` → `editReturn`
- `deletePurchase` → `deleteReturn`
- `loadPurchaseList` → `loadReturnList`

### 2. Update API Endpoints (Find & Replace):
- `/api/v1/wh-purchases` → `/api/v1/wh-purchase-returns`

### 3. Add New Functions:

```javascript
// Load all posted purchases for selection
async function loadPostedPurchases() {
    try {
        const response = await fetch('/api/v1/wh-purchases?status=Posted', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();
        
        if (result.success) {
            const select = document.getElementById('originalPurchaseSelect');
            select.innerHTML = '<option value="">Select Purchase Invoice...</option>';
            result.data.forEach(purchase => {
                const option = document.createElement('option');
                option.value = purchase._id;
                option.textContent = `${purchase.invoiceNo} - ${purchase.supplier.supplierName} - ${new Date(purchase.invoiceDate).toLocaleDateString()}`;
                option.dataset.purchase = JSON.stringify(purchase);
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading purchases:', error);
    }
}

// Load items from selected purchase invoice
function loadPurchaseItems() {
    const select = document.getElementById('originalPurchaseSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption.value) {
        alert('Please select a purchase invoice first');
        return;
    }
    
    const purchase = JSON.parse(selectedOption.dataset.purchase);
    
    // Populate supplier
    document.getElementById('supplierSelect').value = purchase.supplier._id || purchase.supplier;
    
    // Clear existing rows
    document.getElementById('purchaseTableBody').innerHTML = '';
    rowCount = 0;
    
    // Add all items from purchase
    purchase.items.forEach(item => {
        const itemData = {
            _id: item.item._id || item.item,
            name: item.item.name || itemsList.find(i => i._id === item.item)?.name || 'Unknown',
            barcode: item.barcode,
            costPrice: item.costPrice,
            salePrice: item.salePrice,
            retailPrice: item.retailPrice
        };
        
        addNewRow(itemData);
        
        // Fill specific row data
        const row = document.getElementById(`row-${rowCount}`);
        row.querySelector('input[name="batch"]').value = item.batch || '';
        if (item.expiry) row.querySelector('input[name="expiry"]').valueAsDate = new Date(item.expiry);
        row.querySelector('input[name="quantity"]').value = item.quantity;
        row.querySelector('input[name="bonus"]').value = item.bonus;
        row.querySelector('input[name="discPercent"]').value = item.discountPercent;
        row.querySelector('input[name="taxPercent"]').value = item.taxPercent;
        
        calculateRow(rowCount);
    });
    
    alert(`Loaded ${purchase.items.length} items from purchase invoice ${purchase.invoiceNo}`);
}
```

### 4. Call loadPostedPurchases() in initializePage():
Add this line after `loadItems()`:
```javascript
await loadPostedPurchases();
```

### 5. Update Permission Keys:
- `wh_purchase_edit` → `wh_purchase_return_edit`
- `wh_purchase_delete` → `wh_purchase_return_delete`
- `wh_purchase_edit_posted` → `wh_purchase_return_edit_posted`

## Quick Find & Replace Commands:
1. invoiceNo → returnNo (except in loadPurchaseItems function)
2. invoiceDate → returnDate (except in loadPurchaseItems function)
3. purchaseId → returnId
4. savePurchase → saveReturn
5. /api/v1/wh-purchases → /api/v1/wh-purchase-returns
6. wh_purchase_ → wh_purchase_return_

## Note:
The loadPurchaseItems() function still references the original purchase fields (invoiceNo, invoiceDate) because it's loading FROM a purchase TO a return.
