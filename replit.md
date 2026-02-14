# Bilal Accounting System (BAS)

## Overview
A comprehensive business management and accounting system built with Node.js/Express backend and vanilla JavaScript frontend. The system handles sales, purchases, inventory, payroll, and financial reporting.

## Project Structure
```
├── Backend/           # Express.js API server
│   ├── controllers/   # API route handlers
│   ├── middleware/    # Express middleware (auth, validation, etc.)
│   ├── models/        # Mongoose models (MongoDB schemas)
│   ├── routes/        # API route definitions
│   ├── scripts/       # Utility scripts
│   ├── utils/         # Helper utilities
│   └── server.js      # Main server entry point
├── Frontend/          # Static frontend files
│   ├── public/        # CSS and JavaScript assets
│   │   ├── css/       # Stylesheets
│   │   └── js/        # Client-side JavaScript
│   └── views/         # HTML pages
├── index.js           # Root entry point
└── package.json       # Root package configuration
```

## Technology Stack
- **Runtime**: Node.js 20
- **Backend**: Express.js 5.x
- **Database**: MongoDB (MongoDB Atlas)
- **Authentication**: JWT (jsonwebtoken)
- **Frontend**: Vanilla JavaScript, HTML, CSS

## Running the Application
The application starts via the "Start application" workflow which runs `node server.js` in the Backend directory. The server listens on port 5000.

## Environment Variables
Configuration is stored in `Backend/.env`:
- `PORT`: Server port (5000)
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_EXPIRE`: Token expiration time
- `NODE_ENV`: Environment mode

## Key Features
- User authentication and role-based access
- Inventory management (items, categories, stores)
- Sales and purchase tracking
- Customer and supplier management
- Payroll and employee management
- Financial reporting (day book, ledger, etc.)
- Stock audits and adjustments

## Recent Changes
- 2024-12: Initial Replit import and configuration
- Configured server to bind to 0.0.0.0:5000 for Replit compatibility
