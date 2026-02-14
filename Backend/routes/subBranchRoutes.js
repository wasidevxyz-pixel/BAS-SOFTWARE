const express = require('express');
const router = express.Router();
const {
    getSubBranches,
    createSubBranch,
    updateSubBranch,
    deleteSubBranch
} = require('../controllers/subBranchController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(getSubBranches)
    .post(createSubBranch);

router.route('/:id')
    .put(updateSubBranch)
    .delete(deleteSubBranch);

module.exports = router;
