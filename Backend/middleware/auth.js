const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  // If req.user is already set (e.g. by verifyApiKey), skip standard check
  if (req.user) {
    return next();
  }

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if decoded has user object (nested) or id directly (flat)
    const userId = decoded.user ? decoded.user.id : decoded.id;

    req.user = await User.findById(userId).select('-password');

    // Check if user exists
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Check if user is active
    if (!req.user.isActive) {
      return res.status(401).json({ success: false, message: 'User account is deactivated' });
    }

    // Populate Group if exists (to check permissions)
    if (req.user.groupId) {
      await req.user.populate('groupId');
    }

    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// Helper: Check if user has permission via Group
const hasGroupRight = (user, ...keys) => {
  if (!user.groupId || !user.groupId.rights) return false;
  const rights = user.groupId.rights; // Mongoose Map

  for (const key of keys) {
    // Check if using Mongoose Map .get() or plain object access
    const val = (rights instanceof Map) ? rights.get(key) : rights[key];
    if (val === true) return true;
  }
  return false;
};

// Grant access to specific roles or group permissions
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // 1. Check if user's role is specifically authorized
    if (roles.includes(req.user.role)) {
      return next();
    }

    // 2. Check if user has any of these keys as a Group Right (Permission)
    if (hasGroupRight(req.user, ...roles)) {
      return next();
    }

    // 3. Fallback: Always allow if user has full 'admin' or 'administration' right
    if (hasGroupRight(req.user, 'admin', 'administration')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `User role ${req.user.role} is not authorized to access this route`
    });
  };
};

// Role-based access control according to windsurf.md specifications
exports.adminAccess = (req, res, next) => {
  if (req.user.role === 'admin' || hasGroupRight(req.user, 'admin', 'administration')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

// Sales User can manage sales & sales returns only
exports.salesAccess = (req, res, next) => {
  // Allow if role matches OR if has strict sales rights
  if (['admin', 'manager', 'sales'].includes(req.user.role) || hasGroupRight(req.user, 'sales', 'new_sale', 'customer_demand', 'sale_returns')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Sales access required' });
};

// Accounts User manages cash, bank, ledgers & reports
exports.accountsAccess = (req, res, next) => {
  // Check Role
  if (['admin', 'manager', 'accounts'].includes(req.user.role)) {
    return next();
  }

  // Check Group Rights (Accounts OR Bank Management)
  // We include 'bank_management', 'banks', 'expenses', 'vouchers' to cover the various routes protected by this middleware
  if (hasGroupRight(req.user, 'accounts', 'bank_mgmt', 'bank_management', 'banks', 'expenses', 'vouchers', 'payment_vouchers')) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Accounts/Bank access required' });
};

// Manager has limited admin access
exports.managerAccess = (req, res, next) => {
  if (['admin', 'manager'].includes(req.user.role) || hasGroupRight(req.user, 'administration', 'settings')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Manager access required' });
};
