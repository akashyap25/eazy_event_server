const Stripe = require('stripe');
const Order = require('../models/order');
const Event = require('../models/event');
const User = require('../models/user');
const nodemailer = require('nodemailer');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const checkoutOrder = async (req, res) => {
  const { isFree, price, eventTitle, eventId, buyerId } = req.body;
  const amount = isFree ? 0 : Number(price) * 100;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: amount,
            product_data: {
              name: eventTitle,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { eventId, buyerId },
      mode: 'payment',
      success_url: `${process.env.CLIENT_BASE_URL}/`,
      cancel_url: `${process.env.CLIENT_BASE_URL}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createOrder = async (req, res) => {
  try {
    

    const newOrder = await Order.create(req.body);
    res.status(201).json({ success: true, order: newOrder });
  } catch (error) {
   
    res.status(500).json({ success: false, message: error.message });
  }
};

const communicationConfig = require('../config/communicationConfig');
const transporter = communicationConfig.getEmailTransporter();

// Handle Stripe webhook events
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { metadata } = session;
      

      const eventData = await Event.findById(metadata.eventId);


      // Check if the user is already registered for the event
    const existingOrder = await Order.findOne({ buyer: metadata.buyerId, event: metadata.eventId });
    if (existingOrder) {
      // User is already registered for the event
      return res.status(400).json({ success: false, message: 'You have already registered for this event.' });
    }

      // Create order with stripeId
      const newOrder = await Order.create({
        event: metadata.eventId,
        buyer: metadata.buyerId,
        totalAmount: session.amount_total / 100,
        createdAt: new Date(),
        stripeId: session.id, // Include stripeId here
      });

      // Get buyer details
      const buyer = await User.findById(metadata.buyerId);

      // Send email notification
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: buyer.email,
        subject: 'Order Confirmation',
        text: `Thank you for your purchase!\n\nEvent: ${eventData.title}\nAmount: ${session.amount_total / 100} INR\n\nYour order has been placed successfully.`,
      });

      res.json({ received: true });
    } else {
      res.status(400).end(); // Unexpected event type
    }
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};


const getOrdersByEvent = async (req, res) => {
  try {
    

    const eventId = req.params.eventId;

    const orders = await Order.find({ event: eventId })
      .sort({ createdAt: 'desc' })
      .populate('buyer');

    res.status(200).json({
      data: orders
    });
  } catch (error) {
    
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRegisteredUsers = async (req, res) => {
  try {
    

    const eventId = req.params.id;

    const orders = await Order.find({ event: eventId })
      .sort({ createdAt: 'desc' })
      .populate('buyer');

    const users = orders.map((order) => order.buyer);

    res.status(200).json({
      data: users
    });
  } catch (error) {
    
    res.status(500).json({ success: false, message: error.message });
  }
}


const getOrdersByUser = async (req, res) => {
  try {
    

    const userId = req.params.id;

    const orders = await Order.find({ buyer: userId })
      .sort({ createdAt: 'desc' })
      .populate({
        path: 'event',
        populate: { path: 'organizer', select: '_id firstName lastName' },
      });



    res.status(200).json({
      data: orders
    });
  } catch (error) {
   
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  checkoutOrder,
  createOrder,
  getOrdersByEvent,
  getOrdersByUser,
  handleStripeWebhook,
  getRegisteredUsers
};
