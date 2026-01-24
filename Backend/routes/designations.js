const express = require('express');
const {
    getDesignations,
    getDesignation,
    createDesignation,
    updateDesignation,
    deleteDesignation
} = require('../controllers/designationController');

const router = express.Router();

router.route('/')
    .get(getDesignations)
    .post(createDesignation);

router.route('/:id')
    .get(getDesignation)
    .put(updateDesignation)
    .delete(deleteDesignation);

module.exports = router;
