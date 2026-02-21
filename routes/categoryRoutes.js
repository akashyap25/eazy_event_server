const express = require('express');
const { createCategory, getAllCategories } = require('../controllers/categoryController');

const router = express.Router();

router.post('/create', createCategory);
router.get('/', getAllCategories);

module.exports = router;
