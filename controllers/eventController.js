const Event = require('../models/event');
const Order = require('../models/order');
const { queryOptimizer } = require('../utils/queryOptimizer');
const { createCacheMiddleware, cacheKeyGenerators } = require('../middlewares/cacheMiddleware');
const { tryCatch, errorResponses } = require('../utils/errorUtils');

const createEvent = tryCatch(async (req, res) => {
  const {
    title, description, location, imageUrl, startDateTime, endDateTime,
    price, isFree, url, category, capacity, tags
  } = req.body;

  // Get user ID from authentication
  const organizer = req.auth.userId;

  if (isFree) req.body.price = '0';

  const eventData = {
    title,
    description,
    location,
    imageUrl,
    startDateTime,
    endDateTime,
    price,
    isFree,
    url,
    category,
    organizer,
    capacity,
    tags,
  };

  const newEvent = await Event.create(eventData);

  res.status(201).json({ success: true, eventId: newEvent._id });
});

const getAllEvents = tryCatch(async (req, res) => {
  const { 
    status, 
    category, 
    page = 1, 
    limit = 10, 
    sort = 'createdAt',
    order = 'desc',
    search 
  } = req.query;

  // Build query filter
  const filter = {};
  
  if (status) filter.status = status;
  if (category) filter.category = category;
  
  // Add search functionality
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
  }

  // Build sort object
  const sortObj = {};
  sortObj[sort] = order === 'desc' ? -1 : 1;

  // Use optimized query with population
  const result = await queryOptimizer.getEventsWithPopulation(filter, {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: sortObj,
    populate: ['organizer', 'category'],
    cache: true,
    cacheTTL: 300 // 5 minutes
  });

  res.status(200).json({
    success: true,
    data: result.events,
    pagination: result.pagination
  });
});

const getEventById = tryCatch(async (req, res) => {
  const { id } = req.params;
  
  // Use optimized single document population
  const event = await Event.findById(id);
  
  if (!event) {
    return res.status(404).json(errorResponses.notFound('Event not found'));
  }

  // Populate related documents efficiently
  const populatedEvent = await queryOptimizer.populateDocument(event, [
    { fieldName: 'category', model: require('../models/category'), select: { name: 1, description: 1, imageUrl: 1 } },
    { fieldName: 'organizer', model: require('../models/user'), select: { username: 1, firstName: 1, lastName: 1, avatar: 1, email: 1 } },
    { fieldName: 'attendees', model: require('../models/user'), select: { username: 1, firstName: 1, lastName: 1, avatar: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: populatedEvent
  });
});

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.isFree) req.body.price = '0';

    const updatedEvent = await Event.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedEvent) {
      return res.status(404).json({ success: false, message: 'Event update failed' });
    }

    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const eventToDelete = await Event.findByIdAndDelete(id);

    if (!eventToDelete) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

  
    await Order.deleteMany({ event: id });

    res.status(200).json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getEventsByUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth.userId;

    // Ensure user can only access their own events
    if (id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only view your own events.' 
      });
    }

    const events = await Event.find({ organizer: id })
      .populate('category')
      .populate('organizer')
      .sort({ createdAt: -1 });

    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

const getRelatedEvents = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const events = await Event.find({ category: categoryId })
      .populate('category')
      .populate('organizer');

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.attendees.includes(userId)) {
      return res.status(400).json({ success: false, message: 'Already registered' });
    }

    if (event.capacity && event.attendees.length >= event.capacity) {
      return res.status(400).json({ success: false, message: 'Event is full' });
    }

    event.attendees.push(userId);
    await event.save();

    res.status(200).json({ success: true, message: 'Registered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Unregister user from an event
const unregisterFromEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    event.attendees = event.attendees.filter((id) => id.toString() !== userId);
    await event.save();

    res.status(200).json({ success: true, message: 'Unregistered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Automatically update event status based on current time
const updateEventStatuses = async () => {
  try {
    const now = new Date();
    await Event.updateMany(
      { startDateTime: { $lte: now }, endDateTime: { $gt: now } },
      { status: 'ongoing' }
    );
    await Event.updateMany({ endDateTime: { $lte: now } }, { status: 'completed' });
  } catch (error) {
    console.error('Error updating event statuses:', error);
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getEventsByUser,
  getRelatedEvents,
  registerForEvent,
  unregisterFromEvent,
  updateEventStatuses,
};
