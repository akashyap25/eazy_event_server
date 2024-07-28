const Stripe = require('stripe');
const Order = require('../models/order');
const Event = require('../models/event');
const User = require('../models/user');


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const checkoutOrder = async (req, res) => {
  const { isFree, price, eventTitle, eventId, buyerId } = req.body;
  const amount = isFree ? 0 : Number(price) * 100;

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
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
      success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/profile`,
      cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
   
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
};
