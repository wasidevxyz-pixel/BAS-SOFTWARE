const express = require('express');
const router = express.Router();
const { syncBiometricLog, registerFingerprint } = require('../controllers/biometricController');

router.post('/', syncBiometricLog);
router.post('/register', registerFingerprint);

module.exports = router;
