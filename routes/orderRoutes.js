const express = require('express');
const {
  checkoutOrder,
  createOrder,
  getOrdersByEvent,
  getOrdersByUser,
} = require('../controllers/orderController');

const router = express.Router();

router.post('/checkout', checkoutOrder);
router.post('/', createOrder);
router.get('/event', getOrdersByEvent);
router.get('/user', getOrdersByUser);

module.exports = router;
