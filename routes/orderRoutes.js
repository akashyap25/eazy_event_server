const express = require('express');
const {
  checkoutOrder,
  createOrder,
  getOrdersByEvent,
  getOrdersByUser,
  handleStripeWebhook,
  getRegisteredUsers
} = require('../controllers/orderController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Protected routes - require authentication
router.post('/checkout', authenticateToken, checkoutOrder);
router.post('/', authenticateToken, createOrder);
router.get('/event/:id', authenticateToken, getOrdersByEvent);
router.get('/user/:id', authenticateToken, getOrdersByUser);
router.get('/rgstduser/:id', authenticateToken, getRegisteredUsers);

// Webhook route - no auth (Stripe sends these directly)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;
