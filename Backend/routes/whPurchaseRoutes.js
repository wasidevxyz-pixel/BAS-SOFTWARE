const express = require('express');
const {
    createWHPurchase,
    getWHPurchases,
    getWHPurchase,
    updateWHPurchase,
    deleteWHPurchase
} = require('../controllers/whPurchaseController');

const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getWHPurchases)
    .post(createWHPurchase);

router.route('/:id')
    .get(getWHPurchase)
    .put(updateWHPurchase)
    .delete(deleteWHPurchase);

module.exports = router;
