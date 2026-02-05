const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role } = req.body;

  try {
    console.log('Register attempt:', { email, role });
    // Check if user already exists
    let user = await User.findOne({ email });
    console.log('Existing user found?', !!user);
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      name,
      email,
      password,
      role: role || 'sales'
    });

    await user.save();
    console.log('User saved:', { id: user.id, role: user.role });

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE },
      (err, token) => {
        if (err) {
          console.error('JWT sign error:', err);
          return res.status(500).json({ success: false, message: 'Token generation failed' });
        }
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  console.log('ENTERING authController.login');
  console.log('Raw Body:', req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { password } = req.body;
  const loginId = req.body.email ? req.body.email.trim() : '';

  try {
    console.log('Login request body:', req.body);
    // Case-insensitive search to handle existing Mixed Case users
    console.log('Searching for user:', loginId);
    const user = await User.findOne({
      email: { $regex: new RegExp("^" + loginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") }
    }).select('+password');
    console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('User not found in DB');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('User is inactive');
      return res.status(400).json({ message: 'Account is deactivated' });
    }

    // Check password
    console.log('Checking password match...');
    const isMatch = await user.matchPassword(password);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      console.log('Password mismatch');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    // Find user with group rights
    // Find user with group rights
    const fullUser = await User.findById(user._id).populate('groupId');

    // Safe conversion of rights
    // Safe conversion of rights
    let finalizedRights = {};
    if (fullUser.groupId && fullUser.groupId.rights) {
      const groupRights = fullUser.groupId.rights;

      // Check if it's a Map (Mongoose Map)
      if (groupRights instanceof Map || (groupRights.constructor && groupRights.constructor.name === 'Map')) {
        // Iterate using for...of on entries to ensure we get all keys
        for (const [key, value] of groupRights.entries()) {
          finalizedRights[key] = value;
        }
      }
      // Fallback for POJO or formatted object
      else if (typeof groupRights === 'object') {
        Object.keys(groupRights).forEach(key => {
          finalizedRights[key] = groupRights[key];
        });
      }
    }

    // Merge individual user permissions (overrides or additions)
    if (fullUser.permissions && Array.isArray(fullUser.permissions)) {
      fullUser.permissions.forEach(p => {
        finalizedRights[p] = true;
      });
    }

    console.log('Finalized Rights Payload:', JSON.stringify(finalizedRights, null, 2));

    if (!process.env.JWT_SECRET) {
      console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ success: false, message: 'Server misconfiguration: Missing JWT_SECRET' });
    }

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '1d' }, // Default to 1d if missing
      (err, token) => {
        if (err) {
          console.error('JWT Signing Error Stack:', err.stack);
          console.error('JWT Signing Error details:', err);
          return res.status(500).json({ success: false, message: 'Token generation failed: ' + err.message });
        }
        console.log('Login successful, sending token');
        res.json({
          token,
          user: {
            id: fullUser._id,
            name: fullUser.name,
            email: fullUser.email,
            role: fullUser.role,
            branch: fullUser.branch,
            department: fullUser.department,
            group: fullUser.groupId,
            rights: finalizedRights,
            allowedWHCustomerCategories: fullUser.allowedWHCustomerCategories,
            allowedWHItemCategories: fullUser.allowedWHItemCategories
          }
        });
      }
    );
  } catch (err) {
    console.error('Login CRASH Error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res) => {
  try {
    // In a real JWT implementation, the token is stateless
    // The client should handle token removal
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const fullUser = await User.findById(req.user.id).select('-password').populate('groupId');

    // Safe conversion of rights
    // Safe conversion of rights
    let finalizedRights = {};
    if (fullUser.groupId && fullUser.groupId.rights) {
      const groupRights = fullUser.groupId.rights;

      // Check if it's a Map (Mongoose Map)
      if (groupRights instanceof Map || (groupRights.constructor && groupRights.constructor.name === 'Map')) {
        for (const [key, value] of groupRights.entries()) {
          finalizedRights[key] = value;
        }
      }
      else if (typeof groupRights === 'object') {
        Object.keys(groupRights).forEach(key => {
          finalizedRights[key] = groupRights[key];
        });
      }
    }

    // Merge individual user permissions (overrides or additions)
    if (fullUser.permissions && Array.isArray(fullUser.permissions)) {
      fullUser.permissions.forEach(p => {
        finalizedRights[p] = true;
      });
    }

    res.json({
      _id: fullUser._id,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      branch: fullUser.branch,
      department: fullUser.department,
      group: fullUser.groupId,
      rights: finalizedRights,
      allowedWHCustomerCategories: fullUser.allowedWHCustomerCategories,
      allowedWHItemCategories: fullUser.allowedWHItemCategories
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Upload profile photo
// @route   POST /api/auth/profile-photo
// @access  Private
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const file = req.files.file;

    // Make sure the image is a photo
    if (!file.mimetype.startsWith('image')) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    // Check file size (e.g. 5MB limit)
    if (file.size > 5000000) {
      return res.status(400).json({ success: false, message: 'Please upload an image less than 5MB' });
    }

    // Create custom filename
    const path = require('path');
    const fs = require('fs');

    // Ensure uploads directory exists
    const uploadDir = path.join(__dirname, '../../Frontend/public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = path.parse(file.name).ext;
    const fileName = `photo_${req.user.id}_${Date.now()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    file.mv(filePath, async err => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Problem with file upload' });
      }

      const publicUrl = `/uploads/${fileName}`;

      await User.findByIdAndUpdate(req.user.id, { profilePicture: publicUrl });

      res.status(200).json({
        success: true,
        data: publicUrl
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
