const express = require('express');
const {
    getGroups,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup
} = require('../controllers/groupController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin')); // Only admin can manage groups

router
    .route('/')
    .get(getGroups)
    .post(createGroup);

router
    .route('/:id')
    .get(getGroup)
    .put(updateGroup)
    .delete(deleteGroup);

module.exports = router;
