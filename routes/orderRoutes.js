const express = require('express');
const {
  checkoutOrder,
  createOrder,
  getOrdersByEvent,
  getOrdersByUser,
  handleStripeWebhook,
} = require('../controllers/orderController');

const router = express.Router();

router.post('/checkout', checkoutOrder);
router.post('/', createOrder);
router.get('/event', getOrdersByEvent);
router.get('/user/:id', getOrdersByUser);
router.post('/webhook', handleStripeWebhook);

module.exports = router;
