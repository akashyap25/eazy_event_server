const express = require('express');
const {
  checkoutOrder,
  createOrder,
  getOrdersByEvent,
  getOrdersByUser,
  handleStripeWebhook,
  getRegisteredUsers
} = require('../controllers/orderController');

const router = express.Router();

router.post('/checkout', checkoutOrder);
router.post('/', createOrder);
router.get('/event/:id', getOrdersByEvent);
router.get('/user/:id', getOrdersByUser);
router.get('/rgstduser/:id', getRegisteredUsers);


// Ensure this route matches the webhook setup in app.js
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;
