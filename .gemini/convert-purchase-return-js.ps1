# PowerShell script to convert wh-purchase-return.js
$file = "d:\BAS-LIVE\BAS-SOFTWARE\Frontend\public\js\wh-purchase-return.js"
$content = Get-Content $file -Raw

# Replace field IDs and function names
$content = $content -replace "document\.getElementById\('invoiceNo'\)", "document.getElementById('returnNo')"
$content = $content -replace "document\.getElementById\('invoiceDate'\)", "document.getElementById('returnDate')"
$content = $content -replace "document\.getElementById\('purchaseId'\)", "document.getElementById('returnId')"
$content = $content -replace "getElementById\('purchaseId'\)", "getElementById('returnId')"

# Replace function names
$content = $content -replace "function savePurchase", "function saveReturn"
$content = $content -replace "savePurchase\(", "saveReturn("
$content = $content -replace "function editPurchase", "function editReturn"
$content = $content -replace "editPurchase\(", "editReturn("
$content = $content -replace "function deletePurchase", "function deleteReturn"
$content = $content -replace "deletePurchase\(", "deleteReturn("
$content = $content -replace "function loadPurchaseList", "function loadReturnList"
$content = $content -replace "loadPurchaseList\(", "loadReturnList("

# Replace API endpoints
$content = $content -replace "/api/v1/wh-purchases", "/api/v1/wh-purchase-returns"

# Replace permission keys
$content = $content -replace "'wh_purchase_edit'", "'wh_purchase_return_edit'"
$content = $content -replace "'wh_purchase_delete'", "'wh_purchase_return_delete'"
$content = $content -replace "'wh_purchase_edit_posted'", "'wh_purchase_return_edit_posted'"

# Replace variable names in specific contexts
$content = $content -replace "const invoiceNo = document", "const returnNo = document"
$content = $content -replace "const invoiceDate = document", "const returnDate = document"
$content = $content -replace "if \(\!invoiceNo", "if (!returnNo"
$content = $content -replace "if \(\!supplier \|\| \!invoiceDate", "if (!supplier || !returnDate"
$content = $content -replace "invoiceNo: invoiceNo", "returnNo: returnNo"
$content = $content -replace "invoiceDate: invoiceDate", "returnDate: returnDate"

# Save the file
Set-Content -Path $file -Value $content

Write-Host "Conversion complete!" -ForegroundColor Green
Write-Host "File updated: $file" -ForegroundColor Cyan
