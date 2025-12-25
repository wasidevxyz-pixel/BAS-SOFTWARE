const express = require('express');
const {
    getVouchers,
    getVoucher,
    createVoucher,
    updateVoucher,
    deleteVoucher,
    getNextVoucherNumber
} = require('../controllers/voucherController');

const router = express.Router();

const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/next-number/:type', getNextVoucherNumber);

router
    .route('/')
    .get(getVouchers)
    .post(createVoucher);

router
    .route('/:id')
    .get(getVoucher)
    .put(updateVoucher)
    .delete(deleteVoucher);

module.exports = router;
