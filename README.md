# BAS - Bilal Accounting System

> A comprehensive, full-stack accounting and inventory management system designed for retail businesses, pharmacies, and multi-branch operations.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D4.4-green.svg)](https://www.mongodb.com/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## 🎯 Overview

**BAS (Bilal Accounting System)** is a modern, desktop-style web application built to streamline accounting, inventory management, sales tracking, and financial reporting for retail businesses. It features a professional UI with a grayish-blue color scheme, real-time data updates, and comprehensive reporting capabilities.

### Key Highlights

- 🏢 **Multi-Branch Support** - Manage multiple store locations from a single system
- 📊 **Real-Time Reporting** - Live dashboards and financial statements
- 💰 **Complete Accounting** - Double-entry bookkeeping with automated ledgers
- 📦 **Inventory Management** - Track stock levels, categories, and item movements
- 🖨️ **Professional Printing** - A4, A3, and thermal receipt formats
- 🔍 **Advanced Search** - Autocomplete search by name, SKU, or barcode
- 👥 **User Management** - Role-based access control with permissions
- 🌐 **Responsive Design** - Works seamlessly on desktop and tablet devices

---

## ✨ Features

### 🛒 Sales & Purchase Management
- **Sales Entry** - Quick invoice creation with customer selection
- **Purchase Entry** - Supplier management and purchase orders
- **Returns Processing** - Handle sales and purchase returns
- **Payment Tracking** - Record customer and supplier payments
- **Autocomplete Search** - Find items by name, SKU, or barcode instantly

### 📦 Inventory Control
- **Item Management** - Add, edit, and categorize products
- **Stock Tracking** - Real-time stock levels and movements
- **Category Management** - Organize items by categories
- **Barcode Support** - Quick item lookup via barcode scanning
- **Multi-Unit Support** - Pack sizes and unit conversions

### 💼 Accounting & Finance
- **Chart of Accounts** - Comprehensive account hierarchy
- **Journal Entries** - Manual and automated journal vouchers
- **Bank Management** - Multiple bank accounts with reconciliation
- **Expense Tracking** - Record and categorize business expenses
- **Closing Sheets** - Daily cash and bank reconciliation
- **Income Statements** - Profit & loss reporting

### 👥 Party Management
- **Customer Management** - Track customer details and credit limits
- **Supplier Management** - Maintain supplier information and terms
- **Credit Control** - Monitor outstanding balances
- **Payment History** - Complete transaction history

### 📊 Reports & Analytics
- **Sales Reports** - Daily, monthly, and custom date ranges
- **Purchase Reports** - Supplier-wise and item-wise analysis
- **Stock Reports** - Inventory valuation and movement
- **Financial Reports** - Trial balance, P&L, balance sheet
- **Bank Ledgers** - Transaction history with running balance
- **Department Reports** - Branch and department-wise analysis

### 🖨️ Professional Printing
- **Multiple Formats** - A4, A3, and thermal (80mm) receipts
- **Customizable Templates** - Professional invoice layouts
- **Print Preview** - Review before printing
- **PDF Export** - Save as PDF for digital records

### 🎨 User Interface
- **Modern Design** - Professional grayish-blue color scheme
- **Desktop-Style Layout** - Familiar desktop application feel
- **Responsive Tables** - Sortable and filterable data grids
- **Sidebar Navigation** - Collapsible menu with icons
- **Real-Time Updates** - Live data refresh without page reload
- **Keyboard Shortcuts** - Alt+S to save, Enter to add items

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js (v14+)
- **Framework:** Express.js
- **Database:** MongoDB (v4.4+)
- **ODM:** Mongoose
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** Express Validator
- **Logging:** Morgan & Winston

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom styling with CSS variables
- **JavaScript (ES6+)** - Vanilla JS for interactivity
- **Bootstrap 5.3.0** - Responsive grid and components
- **Font Awesome 6.0** - Icon library

### Development Tools
- **Version Control:** Git
- **Package Manager:** npm
- **Environment:** dotenv for configuration
- **CORS:** Cross-Origin Resource Sharing enabled

---

## 💻 System Requirements

### Minimum Requirements
- **OS:** Windows 10/11, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **RAM:** 4 GB
- **Storage:** 500 MB free space
- **Node.js:** v14.0.0 or higher
- **MongoDB:** v4.4 or higher
- **Browser:** Chrome 90+, Firefox 88+, Edge 90+, Safari 14+

### Recommended Requirements
- **RAM:** 8 GB or more
- **Storage:** 2 GB free space
- **Node.js:** v16.0.0 or higher
- **MongoDB:** v5.0 or higher

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/bas-software.git
cd bas-software
```

### 2. Install Backend Dependencies

```bash
cd Backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../Frontend
npm install
```

### 4. Set Up MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# https://www.mongodb.com/try/download/community

# Start MongoDB service
mongod --dbpath /path/to/data/directory
```

**Option B: MongoDB Atlas (Cloud)**
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Get your connection string

### 5. Configure Environment Variables

Create a `.env` file in the `Backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/bas_database
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bas_database

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=30d

# CORS
CORS_ORIGIN=http://localhost:3000

# File Upload
MAX_FILE_SIZE=5242880

# Pagination
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=100
```

### 6. Initialize Database (Optional)

```bash
cd Backend
npm run seed  # If you have seed scripts
```

### 7. Start the Application

**Development Mode:**

```bash
# Terminal 1 - Start Backend
cd Backend
npm start

# Terminal 2 - Start Frontend (if using a dev server)
cd Frontend
npm start
```

**Production Mode:**

```bash
cd Backend
npm run prod
```

### 8. Access the Application

Open your browser and navigate to:
```
http://localhost:5000
```

Default login credentials (change immediately):
- **Username:** admin
- **Password:** admin123

---

## ⚙️ Configuration

### Company Settings

Navigate to **Settings > Company Info** to configure:
- Company name and logo
- Address and contact details
- Tax registration numbers (PAN, GSTIN)
- Financial year settings

### User Management

Navigate to **Settings > Users** to:
- Create new user accounts
- Assign roles and permissions
- Set branch access
- Manage passwords

### Branch Setup

Navigate to **Settings > Branches** to:
- Add store locations
- Configure branch-specific settings
- Assign departments

---

## 📖 Usage

### Quick Start Guide

#### 1. Create Your First Sale

1. Navigate to **Sales > Sales Entry**
2. Select customer (or create new)
3. Search for items by name, SKU, or barcode
4. Enter quantity and pack size
5. Press Enter to add item
6. Click **Save** (or press Alt+S)
7. Click **Print** for invoice

#### 2. Record a Purchase

1. Navigate to **Purchases > Purchase Entry**
2. Select supplier
3. Add items to purchase
4. Enter quantities and prices
5. Save and print purchase order

#### 3. Daily Closing

1. Navigate to **Closing Sheet**
2. Select date and branch
3. Review **Department Opening** tab
4. Complete **Closing 01** (cash summary)
5. Fill **Closing 02** (reconciliation)
6. Review **Income Statement**
7. Save and print

#### 4. Generate Reports

1. Navigate to desired report section
2. Select date range and filters
3. Click **Search** or **Generate**
4. Review data in table
5. Click **Print** for hard copy

---

## 📁 Project Structure

```
bas-software/
├── Backend/
│   ├── config/
│   │   └── db.js                 # Database connection
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── salesController.js    # Sales operations
│   │   ├── purchaseController.js # Purchase operations
│   │   └── ...
│   ├── models/
│   │   ├── User.js               # User schema
│   │   ├── Sale.js               # Sales schema
│   │   ├── Item.js               # Item schema
│   │   └── ...
│   ├── routes/
│   │   ├── auth.js               # Auth routes
│   │   ├── sales.js              # Sales routes
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.js               # JWT verification
│   │   ├── errorHandler.js       # Error handling
│   │   └── ...
│   ├── utils/
│   │   └── helpers.js            # Utility functions
│   ├── .env                      # Environment variables
│   ├── server.js                 # Express server
│   └── package.json
│
├── Frontend/
│   ├── public/
│   │   ├── css/
│   │   │   ├── desktop-style.css # Global styles
│   │   │   └── sidebar.css       # Sidebar styles
│   │   ├── js/
│   │   │   ├── sales.js          # Sales page logic
│   │   │   ├── purchases.js      # Purchase page logic
│   │   │   ├── items.js          # Items page logic
│   │   │   └── ...
│   │   └── images/
│   ├── views/
│   │   ├── index.html            # Login page
│   │   ├── main.html             # Dashboard
│   │   ├── sales.html            # Sales entry
│   │   ├── purchases.html        # Purchase entry
│   │   ├── items.html            # Item management
│   │   ├── closing-sheet.html    # Daily closing
│   │   ├── bank-management.html  # Bank operations
│   │   ├── print-invoice.html    # Invoice print template
│   │   ├── print-closing-sheet.html
│   │   ├── print-bank-ledger.html
│   │   └── ...
│   └── package.json
│
├── .gitignore
├── README.md
└── LICENSE
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication

All API requests (except login) require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Key Endpoints

#### Authentication
```
POST   /api/v1/auth/login          # User login
POST   /api/v1/auth/register       # User registration
GET    /api/v1/auth/me             # Get current user
POST   /api/v1/auth/logout         # User logout
```

#### Sales
```
GET    /api/v1/sales               # Get all sales
POST   /api/v1/sales               # Create new sale
GET    /api/v1/sales/:id           # Get sale by ID
PUT    /api/v1/sales/:id           # Update sale
DELETE /api/v1/sales/:id           # Delete sale
```

#### Purchases
```
GET    /api/v1/purchases           # Get all purchases
POST   /api/v1/purchases           # Create new purchase
GET    /api/v1/purchases/:id       # Get purchase by ID
PUT    /api/v1/purchases/:id       # Update purchase
DELETE /api/v1/purchases/:id       # Delete purchase
```

#### Items
```
GET    /api/v1/items               # Get all items
POST   /api/v1/items               # Create new item
GET    /api/v1/items/:id           # Get item by ID
PUT    /api/v1/items/:id           # Update item
DELETE /api/v1/items/:id           # Delete item
GET    /api/v1/items/search        # Search items
```

#### Parties (Customers/Suppliers)
```
GET    /api/v1/parties             # Get all parties
POST   /api/v1/parties             # Create new party
GET    /api/v1/parties/:id         # Get party by ID
PUT    /api/v1/parties/:id         # Update party
DELETE /api/v1/parties/:id         # Delete party
```

For complete API documentation, visit `/api-docs` when the server is running.

---

## 📸 Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Sales Entry
![Sales Entry](docs/screenshots/sales-entry.png)

### Item Management
![Item Management](docs/screenshots/items.png)

### Closing Sheet
![Closing Sheet](docs/screenshots/closing-sheet.png)

### Reports
![Reports](docs/screenshots/reports.png)

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/AmazingFeature
   ```
5. **Open a Pull Request**

### Coding Standards
- Use ES6+ JavaScript features
- Follow existing code style
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation as needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

### Documentation
- [User Guide](docs/user-guide.md)
- [API Reference](docs/api-reference.md)
- [Troubleshooting](docs/troubleshooting.md)

### Contact
- **Email:** support@bas-software.com
- **Website:** https://bas-software.com
- **Issues:** [GitHub Issues](https://github.com/yourusername/bas-software/issues)

### Community
- [Discord Server](https://discord.gg/bas-software)
- [Forum](https://forum.bas-software.com)

---

## 🎉 Acknowledgments

- **BAS Development Team** - For their dedication and hard work
- **Contributors** - Thank you to all who have contributed
- **Open Source Community** - For the amazing tools and libraries

---

## 🗺️ Roadmap

### Version 2.0 (Planned)
- [ ] Mobile app (iOS & Android)
- [ ] Advanced analytics dashboard
- [ ] Multi-currency support
- [ ] Automated backup system
- [ ] Email notifications
- [ ] WhatsApp integration
- [ ] Barcode label printing
- [ ] Cloud synchronization

### Version 1.5 (In Progress)
- [x] Autocomplete item search
- [x] Professional print templates
- [x] Enhanced color scheme
- [ ] Advanced reporting
- [ ] Export to Excel/PDF
- [ ] Audit trail

---

## 📊 Project Stats

- **Lines of Code:** 50,000+
- **Files:** 100+
- **Contributors:** 5+
- **Active Users:** Growing
- **Last Updated:** December 2025

---

<div align="center">

**Made with ❤️ by the BAS Team**

[⬆ Back to Top](#bas---bilal-accounting-system)

</div>
