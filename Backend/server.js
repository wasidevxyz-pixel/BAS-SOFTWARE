require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const { wasiPerformanceBooster, wasiApiHealthMonitor, wasiSystemHealthCheck } = require('./middleware/wasiPerformance');
const cookieParser = require('cookie-parser');
const fileupload = require('express-fileupload');
const morgan = require('morgan');

// Route files
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const partyRoutes = require('./routes/parties');
const saleRoutes = require('./routes/sales');
const purchaseRoutes = require('./routes/purchases');
const paymentRoutes = require('./routes/payments');
const receiptRoutes = require('./routes/receipts');
const expenseRoutes = require('./routes/expenses');
const stockAdjustmentRoutes = require('./routes/stockAdjustments');
const stockAuditRoutes = require('./routes/stockAudits');
const voucherRoutes = require('./routes/vouchers');
const supplierPaymentRoutes = require('./routes/supplierPayments');
const customerPaymentRoutes = require('./routes/customerPayments');
const salesReturnRoutes = require('./routes/salesReturns');
const purchaseReturnRoutes = require('./routes/purchaseReturns');
const payrollRoutes = require('./routes/payrolls');
const cashTransactionRoutes = require('./routes/cashTransactions');
const bankTransactionRoutes = require('./routes/bankTransactions');
const bankTransferRoutes = require('./routes/bankTransfers');
const bankRoutes = require('./routes/banks');
const dayBookRoutes = require('./routes/dayBook');
const unitRoutes = require('./routes/units');
const taxRoutes = require('./routes/taxes');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const itemCategoryRoutes = require('./routes/itemCategories');
const customerCategoryRoutes = require('./routes/customerCategories');
const supplierCategoryRoutes = require('./routes/supplierCategories');
const companyRoutes = require('./routes/companies');
const classRoutes = require('./routes/classes');
const subclassRoutes = require('./routes/subclasses');
const storeRoutes = require('./routes/stores');
const departmentRoutes = require('./routes/departments');
const closingSheetRoutes = require('./routes/closingSheets');
const dailyCashRoutes = require('./routes/dailyCash');
const cashSaleRoutes = require('./routes/cashSales');
const healthRoutes = require('./routes/health');
const expenseHeadRoutes = require('./routes/expenseHeads');
const diagnosticRoutes = require('./routes/diagnostic');
const supplierTaxRoutes = require('./routes/supplierTaxes');
const accountRoutes = require('./routes/accounts');
const attendanceRoutes = require('./routes/attendance');
const customerDemandRoutes = require('./routes/customerDemands');
const employeeRoutes = require('./routes/employees');
const employeeAdjustmentRoutes = require('./routes/employeeAdjustments');
const supplierRoutes = require('./routes/suppliers');
const employeeAdvanceRoutes = require('./routes/employeeAdvances');
const employeeClearanceRoutes = require('./routes/employeeClearances');
const employeeCommissionRoutes = require('./routes/employeeCommissions');
const employeePenaltyRoutes = require('./routes/employeePenalties');
const holyDayRoutes = require('./routes/holyDays');
const supplierTaxCPRRoutes = require('./routes/supplierTaxCPRs');
const groupRoutes = require('./routes/groups');
const backupRoutes = require('./routes/backup');


// Error handler
const errorHandler = require('./middleware/errorHandler');

const app = express();

// WASI Health Monitor (Before other middleware to capture all requests)
app.use(wasiApiHealthMonitor);

// Global Request Logger
app.use((req, res, next) => {
  console.log('\n========================================');
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Content-Type: ${req.headers['content-type']}`);
  console.log('========================================\n');
  next();
});

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Set security headers
// Set security headers - Disabled completely for debugging
// app.use(helmet({
//   contentSecurityPolicy: false,
// }));

// Rate limiting temporarily disabled
// const limiter = rateLimit({
//   windowMs: 10 * 60 * 1000,
//   max: 100
// });
// app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log request body for POST/PUT requests
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL injection - temporarily disabled due to Express v5 req.query setter incompatibility
// app.use('/api/', mongoSanitize());

// Data sanitization against XSS
// app.use(xssClean()); // Commented out - package not installed

// Prevent parameter pollution
// app.use(hpp());

// File upload middleware temporarily disabled
app.use(fileupload());

// Compression middleware
// Compression middleware (Replaced by WASI Booster)
// app.use(compression());
wasiPerformanceBooster(app);

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Disable caching for all routes (Global Middleware)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Set static folder for public assets with NO CACHE
app.use(express.static(path.join(__dirname, '../Frontend/public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// Serve static files from views directory with NO CACHE
app.use(express.static(path.join(__dirname, '../Frontend/views'), {
  etag: false,
  lastModified: false,
  index: false,
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// ... [skipping db connection] ...

// Database connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory')
  .then(async () => {
    console.log('Connected to MongoDB');

    try {
      // Migration: Generate codes for parties that don't have one
      const Party = require('./models/Party');
      const partiesWithoutCode = await Party.find({ code: { $exists: false } });

      if (partiesWithoutCode.length > 0) {
        console.log(`Found ${partiesWithoutCode.length} parties without code. Generating codes...`);
        let nextCode = 1;

        // Find highest existing code to start from
        const lastParty = await Party.findOne({ code: { $exists: true } }).sort({ code: -1 });
        if (lastParty && lastParty.code) {
          const parts = lastParty.code.split('-');
          if (parts.length > 1 && !isNaN(parts[1])) {
            nextCode = parseInt(parts[1]) + 1;
          }
        }

        for (const party of partiesWithoutCode) {
          let newCode = '';
          let isUnique = false;
          while (!isUnique) {
            newCode = `CUST-${String(nextCode).padStart(3, '0')}`;
            const exists = await Party.findOne({ code: newCode });
            if (!exists) {
              isUnique = true;
            } else {
              nextCode++;
            }
          }
          party.code = newCode;
          await party.save();
          console.log(`Assigned code ${newCode} to party ${party.name}`);
          nextCode++;
        }
        console.log('Party code migration completed.');
      }
    } catch (err) {
      console.error('Migration error:', err);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Health check
app.get('/api/v1/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// WASI System Health Check
app.get('/api/v1/wasi-health', wasiSystemHealthCheck);

// Mount routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/items', itemRoutes);
app.use('/api/v1/parties', partyRoutes);
app.use('/api/v1/sales', saleRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/receipts', receiptRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/stock-adjustments', stockAdjustmentRoutes);
app.use('/api/v1/stock-audits', stockAuditRoutes);
app.use('/api/v1/vouchers', voucherRoutes);
app.use('/api/v1/supplier-payments', supplierPaymentRoutes);
app.use('/api/v1/customer-payments', customerPaymentRoutes);
app.use('/api/v1/sales-returns', salesReturnRoutes);
app.use('/api/v1/purchase-returns', purchaseReturnRoutes);
app.use('/api/v1/payrolls', payrollRoutes);
app.use('/api/v1/cash-transactions', cashTransactionRoutes);
app.use('/api/v1/bank-transactions', bankTransactionRoutes);
app.use('/api/v1/bank-transfers', bankTransferRoutes);
app.use('/api/v1/banks', bankRoutes);
app.use('/api/v1/daybook', dayBookRoutes);
app.use('/api/v1/units', unitRoutes);
app.use('/api/v1/taxes', taxRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/item-categories', itemCategoryRoutes);
app.use('/api/v1/customer-categories', customerCategoryRoutes);
app.use('/api/v1/supplier-categories', supplierCategoryRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/subclasses', subclassRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/closing-sheets', closingSheetRoutes);
app.use('/api/v1/daily-cash', dailyCashRoutes);
app.use('/api/v1/cash-sales', cashSaleRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/expense-heads', expenseHeadRoutes);
app.use('/api/v1/diagnostic', diagnosticRoutes);
app.use('/api/v1/supplier-taxes', supplierTaxRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/customer-demands', customerDemandRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/employee-adjustments', employeeAdjustmentRoutes);
app.use('/api/v1/employee-advances', employeeAdvanceRoutes);
app.use('/api/v1/employee-clearances', employeeClearanceRoutes);
app.use('/api/v1/employee-commissions', employeeCommissionRoutes);
app.use('/api/v1/employee-penalties', employeePenaltyRoutes);
app.use('/api/v1/holy-days', holyDayRoutes);
app.use('/api/v1/supplier-tax-cprs', supplierTaxCPRRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/backup', backupRoutes);


// Serve login page at root
app.get('/', (req, res) => {
  const loginPath = path.join(__dirname, '../Frontend/views', 'login.html');
  console.log('Attempting to serve login from (fs):', loginPath);
  require('fs').readFile(loginPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading login.html:', err);
      res.status(500).send(`Error reading login page: ${err.message}`);
    } else {
      res.send(data);
    }
  });
});

// Serve login page specific route
app.get('/login.html', (req, res) => {
  const loginPath = path.join(__dirname, '../Frontend/views', 'login.html');
  require('fs').readFile(loginPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading login.html:', err);
      res.status(500).send(`Error reading login page: ${err.message}`);
    } else {
      res.send(data);
    }
  });
});

// Serve main page
app.get('/main.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'main.html'), (err) => {
    if (err) {
      console.error('Error serving main.html:', err);
      res.status(500).send('Error loading main page');
    }
  });
});

// Serve dashboard
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'dashboard.html'), (err) => {
    if (err) {
      console.error('Error serving dashboard.html:', err);
      res.status(500).send('Error loading dashboard');
    }
  });
});

app.get('/items.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'items.html'));
});

app.get('/parties.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'parties.html'));
});

app.get('/sales.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'sales.html'));
});

app.get('/purchases.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'purchases.html'));
});

app.get('/reports.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'reports.html'));
});

app.get('/bank-ledger.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'bank-ledger.html'));
});

app.get('/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'settings.html'));
});

app.get('/units.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'units.html'));
});

app.get('/taxes.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'taxes.html'));
});

// Serve other pages
app.get('/sales-returns.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'sale-returns.html'));
});

app.get('/purchase-returns.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'purchase-returns.html'));
});

app.get('/cash-transactions.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'cash-transactions.html'));
});

app.get('/bank-transactions.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'bank-transactions.html'));
});

app.get('/daybook.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'daybook.html'));
});

app.get('/ledger.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'ledger.html'));
});

app.get('/trial-balance.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'trial-balance.html'));
});

app.get('/voucher.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views/voucher.html'));
});

app.get('/voucher-list.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views/voucher-list.html'));
});

app.get('/users.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'users.html'));
});

app.get('/groups.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'groups.html'));
});

app.get('/backup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'backup.html'));
});

app.get('/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'profile.html'));
});

// ... [skipping requires] ...

app.get('/account-groups.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'account-groups.html'));
});

app.get('/account-categories.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'account-categories.html'));
});

app.get('/accounts.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'accounts.html'));
});

app.get('/banks.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'banks.html'));
});

app.get('/customer-demand.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'customer-demand.html'));
});

// New Pages
app.get('/branch-departments.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'branch-departments.html'));
});
app.get('/daily-cash.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'daily-cash.html'));
});
app.get('/cash-counter.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'cash-counter.html'));
});
app.get('/closing-sheet.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'closing-sheet.html'));
});
app.get('/supplier-wh-tax.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'supplier-wh-tax.html'));
});
app.get('/supplier-tax-report.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'supplier-tax-report.html'));
});

// ... [skipping routes requires] ...

// Payroll HTML Pages
app.get('/employee-registration.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'employee-registration.html'));
});

app.get('/payroll.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'payroll.html'));
});

app.get('/attendance-list.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'attendance-list.html'));
});

app.get('/attendance-add.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'attendance-add.html'));
});

app.get('/employee-advance.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'employee-advance.html'));
});

app.get('/stores.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'stores.html'));
});

app.get('/holy-days.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'holy-days.html'));
});

app.get('/wht-supplier.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'wht-supplier.html'));
});

app.get('/employee-commission.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'employee-commission.html'));
});

app.get('/employee-penalty.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'employee-penalty.html'));
});

app.get('/employee-clearance.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'employee-clearance.html'));
});

app.get('/employee-adjustment.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'employee-adjustment.html'));
});


app.get('/print-invoice.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'print-invoice.html'));
});

app.get('/voucher-print.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/views', 'voucher-print.html'));
});

// Serve the main HTML file for all other routes (catch-all)
app.use((req, res, next) => {
  // Skip API routes and static files
  if (req.path.startsWith('/api/') || req.path.startsWith('/js/') || req.path.startsWith('/css/') || req.path.includes('.')) {
    return next();
  }

  // Serve dashboard.html for all other routes
  const indexPath = path.join(__dirname, '../Frontend/views', 'dashboard.html');
  if (req.path === '/' || !req.path.includes('.')) {
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving dashboard.html:', err);
        res.status(500).json({ success: false, message: 'Server error' });
      }
    });
  } else {
    next();
  }
});

// Handle 404 for API routes
app.use('/api', (req, res, next) => {
  res.status(404).json({ success: false, message: `API Route not found: ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({ success: false, message: err && err.message ? err.message : 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
