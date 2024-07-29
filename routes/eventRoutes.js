const express = require('express');
const {
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventsByUser,
  getRelatedEvents,
} = require('../controllers/eventController');

const router = express.Router();

router.post('/create', createEvent);
router.get('/related', getRelatedEvents);
router.get('/', getAllEvents);
router.get('/:id', getEventById);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);
router.get('/user/:id', getEventsByUser);


module.exports = router;