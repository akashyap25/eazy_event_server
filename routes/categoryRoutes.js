const express = require('express');
const { createCategory, getAllCategories } = require('../controllers/categoryController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Create category requires authentication
router.post('/create', authenticateToken, createCategory);
// Get all categories is public
router.get('/', getAllCategories);

module.exports = router;
