const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    createdAt: {
      type: Date,
      default: Date.now,
    },
    stripeId: {
      type: String,
      required: true,
      unique: true,
    },
    totalAmount: {
      type: String,
    },
    event: {
      type: mongoose.Schema.ObjectId,
      ref: 'Event',
    },
    buyer: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  })
  
  const Order = mongoose.model('Order', OrderSchema)

  module.exports = Order;