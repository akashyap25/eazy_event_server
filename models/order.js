const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    createdAt: {
      type: Date,
      default: Date.now,
    },
    stripeId: {
      type: String,
      required: false,
      unique: false, // Remove unique constraint to allow multiple null values
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
    quantity: {
      type: Number,
      default: 1,
    },
    paymentMethod: {
      type: String,
      default: 'card',
    },
    paymentId: {
      type: String,
      unique: true,
      sparse: true, // This allows multiple null values
    },
  })
  
  const Order = mongoose.model('Order', OrderSchema)

  module.exports = Order;