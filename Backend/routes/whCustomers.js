const express = require('express');
const router = express.Router();
const {
    getWHCustomers,
    getWHCustomer,
    createWHCustomer,
    updateWHCustomer,
    deleteWHCustomer,
    getNextCode
} = require('../controllers/whCustomerController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/next-code', getNextCode);

router.route('/')
    .get(getWHCustomers)
    .post(createWHCustomer);

router.route('/:id')
    .get(getWHCustomer)
    .put(updateWHCustomer)
    .delete(deleteWHCustomer);

module.exports = router;
