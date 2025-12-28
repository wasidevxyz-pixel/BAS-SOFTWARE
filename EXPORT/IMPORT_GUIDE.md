# Supplier Data Export - Production Import Guide

## Overview
This package contains **1,804 withholding suppliers** exported from the development database.

**Export Date:** December 27, 2025  
**Total Suppliers:** 1,804

## Branch Distribution
- **(F-6):** 44 suppliers
- **(Ghouri Town):** 339 suppliers  
- **(PWD-1):** 305 suppliers
- **(Pakistan Town):** 9 suppliers
- **(Gujar Khan):** 143 suppliers
- **(Chandni Chowk):** 358 suppliers
- **(G15 Markaz):** 316 suppliers
- **(Attock):** 290 suppliers

## Files Included

### 1. `suppliers_export_2025-12-27T17-55-12.json` (987 KB)
- **Format:** Pretty-printed JSON array
- **Use:** For MongoDB Compass import or manual review
- **Size:** ~1 MB

### 2. `suppliers_mongoimport_2025-12-27T17-55-12.json` (760 KB)
- **Format:** NDJSON (newline-delimited JSON)
- **Use:** For `mongoimport` command-line tool
- **Size:** ~760 KB

### 3. `export_summary_2025-12-27T17-55-12.json`
- Summary of the export with breakdown by branch

---

## Import Methods

### ⭐ Method 1: Using Node.js Import Script (Recommended)

This method uses the provided import script with proper error handling.

**Step 1:** Upload files to production server
```bash
# Copy the JSON file and import script to production
scp suppliers_export_2025-12-27T17-55-12.json user@production-server:/path/to/BAS-SOFTWARE/Backend/exports/
scp import-from-json.js user@production-server:/path/to/BAS-SOFTWARE/Backend/
```

**Step 2:** Run the import script
```bash
cd /path/to/BAS-SOFTWARE/Backend

# Dry run (shows what will happen without importing)
node import-from-json.js exports/suppliers_export_2025-12-27T17-55-12.json

# Actual import (with --force flag)
node import-from-json.js exports/suppliers_export_2025-12-27T17-55-12.json --force
```

**What happens:**
- ✅ Connects to production MongoDB
- ✅ Deletes existing withholding suppliers
- ✅ Imports all 1,804 suppliers
- ✅ Shows progress and error messages
- ✅ Provides detailed summary

---

### Method 2: Using mongoimport Command

This is the fastest method using MongoDB's native import tool.

```bash
mongoimport --uri="mongodb://your-production-uri/database-name" \
  --collection=suppliers \
  --file=suppliers_mongoimport_2025-12-27T17-55-12.json \
  --mode=upsert \
  --upsertFields=_id
```

**Example for local production:**
```bash
mongoimport --db=sales-inventory \
  --collection=suppliers \
  --file=suppliers_mongoimport_2025-12-27T17-55-12.json \
  --mode=insert
```

**Example with authentication:**
```bash
mongoimport --uri="mongodb://username:password@host:port/database?authSource=admin" \
  --collection=suppliers \
  --file=suppliers_mongoimport_2025-12-27T17-55-12.json
```

---

### Method 3: Using MongoDB Compass (GUI)

Best for small imports or if you want visual confirmation.

**Steps:**
1. Open MongoDB Compass
2. Connect to your production database
3. Navigate to the `suppliers` collection
4. Click **"ADD DATA"** → **"Import JSON or CSV file"**
5. Select `suppliers_export_2025-12-27T17-55-12.json`
6. Review the preview
7. Click **"Import"**

**Note:** For large files, Compass may be slow. Use Method 1 or 2 for better performance.

---

## Pre-Import Checklist

Before importing to production:

- [ ] **Backup production database**
  ```bash
  mongodump --uri="mongodb://production-uri" --out=/backup/before-supplier-import
  ```

- [ ] **Verify MongoDB connection**
  ```bash
  mongo "mongodb://production-uri" --eval "db.serverStatus()"
  ```

- [ ] **Check if suppliers collection exists**
  ```bash
  mongo "mongodb://production-uri/database" --eval "db.suppliers.countDocuments()"
  ```

- [ ] **Ensure branch IDs match production**
  - The exported data contains branch ObjectIDs from development
  - If production has different branch IDs, you'll need to update them
  - Run the branch mapping script (see below)

---

## Post-Import Verification

After import, verify the data:

```bash
# Connect to MongoDB shell
mongo "mongodb://production-uri/database-name"

# Check total suppliers
db.suppliers.countDocuments()
# Expected: 1804

# Check suppliers by branch
db.suppliers.aggregate([
  { $group: { _id: "$branch", count: { $sum: 1 } } }
])

# Check suppliers by category
db.suppliers.aggregate([
  { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "cat" } },
  { $unwind: "$cat" },
  { $group: { _id: "$cat.name", count: { $sum: 1 } } }
])

# Check for suppliers with WHT info
db.suppliers.countDocuments({ whtPer: { $gt: 0 } })
# Expected: Should be > 0

# Sample some suppliers
db.suppliers.find().limit(5).pretty()
```

---

## Important Notes

### Branch ID Mapping
⚠️ **CRITICAL:** The exported suppliers contain branch ObjectIDs from the development database. 

**If your production branches have different IDs, you MUST update them before or after import!**

**To check branch IDs in production:**
```javascript
db.stores.find({}, { _id: 1, name: 1 })
```

**Branch ID Mapping from Development:**
- `69400d11b12b8decd2e26c4c` → (PWD-1)
- `694011025aae0ca6bba05ba5` → (F-6)
- `69468989dd7000a029b3177a` → (Ghouri Town)
- `694689acdd7000a029b31784` → (Pakistan Town)
- `694689bddd7000a029b31789` → (Gujar Khan)
- `694689d0dd7000a029b31790` → (Chandni Chowk)
- `69468a04dd7000a029b3179c` → (G15 Markaz)
- `69468a14dd7000a029b317a1` → (Attock)

### Category ID Mapping
Similarly, category ObjectIDs need to match production:
- Medicine
- Cosmetics
- Grocery
- Homeo
- Under Garments
- Sale Percentage

---

## Rollback Plan

If something goes wrong, restore from backup:

```bash
# Restore entire database
mongorestore --uri="mongodb://production-uri" /backup/before-supplier-import

# Or restore just suppliers collection
mongorestore --uri="mongodb://production-uri" \
  --collection=suppliers \
  /backup/before-supplier-import/database-name/suppliers.bson
```

---

## Troubleshooting

### Issue: "Duplicate key error"
**Solution:** Some suppliers already exist. Use `--mode=upsert` with mongoimport or delete existing suppliers first.

### Issue: "Branch not found" errors
**Solution:** Branch IDs don't match. Update branch references before import (see Branch ID Mapping section).

### Issue: "Category not found" errors  
**Solution:** Category IDs don't match. Update category references before import.

### Issue: Import is very slow
**Solution:** 
- Disable indexes temporarily
- Use mongoimport instead of Node.js script
- Import in batches

---

## Support

For issues or questions:
1. Check the error logs
2. Verify branch and category IDs match
3. Ensure MongoDB version compatibility
4. Contact the development team

---

## Success Criteria

Import is successful when:
- ✅ 1,804 suppliers imported
- ✅ All branches have correct supplier counts
- ✅ All suppliers have valid category references
- ✅ WHT information is preserved
- ✅ Frontend branch filtering works correctly

---

**Generated:** December 27, 2025  
**Version:** 1.0
