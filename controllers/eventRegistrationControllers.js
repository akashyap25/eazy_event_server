const e = require('express');
const EventRegistrationSQL = require('../models/eventRegistrationModel');

const handleErrors = (err) => {
  let errors = {
    eventId: '',
    userId: '',
    transactionId: ''
  };

  if (err.message.includes('Event registration validation failed')) {
    Object.values(err.errors).forEach(({ properties }) => {
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};

module.exports.createEventRegistration = async (req, res) => {
  try {
    const { eventId, userId, transactionId } = req.body;

    // Check if the user is already registered for the event
    const existingRegistration = await EventRegistrationSQL.getEventRegistrationById(eventId, userId);
    if (existingRegistration) {
      return res.status(400).json({ message: 'User is already registered for the event' });
    }

    const newEventRegistration = {
      eventId,
      userId,
      transactionId
    };

    const eventRegistrationId = await EventRegistrationSQL.createEventRegistration(newEventRegistration);
    res.status(201).json({ eventRegistrationId, created: true });
  } catch (err) {
    console.error(err);
    const errors = handleErrors(err);
    res.status(400).json({ errors, created: false });
  }
};

module.exports.getEventRegistration = async (req, res) => {
  const { userId, eventId } = req.params;
  try {
    const eventRegistration = await EventRegistrationSQL.getEventRegistrationById(eventId, userId);
    if (eventRegistration) {
      res.status(200).json({ eventRegistration });
    } else {
      res.status(404).json({ message: 'Event registration not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports.getAllEventRegistrations = async (req, res) => {
  const eventId = req.params.eventId;
  try {
    const eventRegistrations = await EventRegistrationSQL.getAllEventRegistrations(eventId);
    res.status(200).json({ eventRegistrations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports.getEventRegistrationByUserId = async (req, res) => {
  const userId = req.params.userId;
  try {
    const eventRegistration = await EventRegistrationSQL.getEventRegistrationByUserId(userId);
   
    if (eventRegistration) {
      res.status(200).json({ eventRegistration });
    } else {
      res.status(404).json({ message: 'Event registration not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
