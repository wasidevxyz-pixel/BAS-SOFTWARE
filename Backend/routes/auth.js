const express = require('express');
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Login ID is required').not().isEmpty(),
    check('password', 'Please enter a password with 5 or more characters').isLength({ min: 5 })
  ],
  authController.register
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    check('email', 'Login ID is required').not().isEmpty(),
    check('password', 'Password is required').exists()
  ],
  authController.login
);

// @route   POST api/auth/logout
// @desc    Logout user
// @access  Public
router.post('/logout', authController.logout);

// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth.protect, authController.getMe);
router.post('/profile-photo', auth.protect, authController.uploadPhoto);

module.exports = router;
