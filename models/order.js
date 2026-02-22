const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    createdAt: {
      type: Date,
      default: Date.now,
    },
    stripeId: {
      type: String,
      required: false,
      unique: false,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    event: {
      type: mongoose.Schema.ObjectId,
      ref: 'Event',
    },
    buyer: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    organizationId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Organization',
      index: true,
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
      sparse: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled', 'refunded'],
      default: 'pending',
    },
  }, { timestamps: true });

// Indexes for better query performance
OrderSchema.index({ event: 1, createdAt: -1 });
OrderSchema.index({ buyer: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
  
const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;