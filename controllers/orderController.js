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
      success_url: `${process.env.CLIENT_BASE_URL}/profile/${buyerId}`,
      cancel_url: `${process.env.CLIENT_BASE_URL}/events/${eventId}`,
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

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Handle Stripe webhook events
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { metadata } = session;

      // Create order
      const newOrder = await Order.create({
        event: metadata.eventId,
        buyer: metadata.buyerId,
        totalAmount: session.amount_total / 100,
        createdAt: new Date(),
      });

      // Get buyer details
      const buyer = await User.findById(metadata.buyerId);

      // Send email notification
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: buyer.email,
        subject: 'Order Confirmation',
        text: `Thank you for your purchase!\n\nEvent: ${session.line_items[0].description}\nAmount: ${session.amount_total / 100} INR\n\nYour order has been placed successfully.`,
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
    

    const { searchString, eventId } = req.query;
    const orders = await Order.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'buyer',
          foreignField: '_id',
          as: 'buyer',
        },
      },
      { $unwind: '$buyer' },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'event',
        },
      },
      { $unwind: '$event' },
      {
        $project: {
          _id: 1,
          totalAmount: 1,
          createdAt: 1,
          eventTitle: '$event.title',
          eventId: '$event._id',
          buyer: { $concat: ['$buyer.firstName', ' ', '$buyer.lastName'] },
        },
      },
      {
        $match: {
          $and: [
            { eventId: mongoose.Types.ObjectId(eventId) },
            { buyer: { $regex: new RegExp(searchString, 'i') } },
          ],
        },
      },
    ]);

    res.status(200).json(orders);
  } catch (error) {
   
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrdersByUser = async (req, res) => {
  try {
    

    const { userId, limit = 3, page = 1 } = req.query;
    const skipAmount = (Number(page) - 1) * Number(limit);

    const orders = await Order.find({ buyer: userId })
      .sort({ createdAt: 'desc' })
      .skip(skipAmount)
      .limit(Number(limit))
      .populate({
        path: 'event',
        populate: { path: 'organizer', select: '_id firstName lastName' },
      });

    const ordersCount = await Order.countDocuments({ buyer: userId });

    res.status(200).json({
      data: orders,
      totalPages: Math.ceil(ordersCount / Number(limit)),
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
  handleStripeWebhook
};
