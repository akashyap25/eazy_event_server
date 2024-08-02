const Event = require('../models/event');
const Order = require('../models/order');

const createEvent = async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).json({ success: true, eventId: event._id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate('category')
      .populate('organizer');
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id)
      .populate('category')
      .populate('organizer');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
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
    // Delete all orders related to the event
    await Order.deleteMany({ event: id });

    res.status(200).json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getEventsByUser = async (req, res) => {
  try {
    const { id } = req.params;
    const events = await Event.find({ organizer: id })
      .populate('category')
      .populate('organizer');
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getEventsByUser,
  getRelatedEvents,
};