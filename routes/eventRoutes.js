const express = require('express');
const {
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventsByUser,
  getRelatedEvents,
  registerForEvent,
  unregisterFromEvent,
} = require('../controllers/eventController');
const { authenticateToken, requireAuth, requireEventOwnership, optionalAuth } = require('../middlewares/authMiddleware');
const { eventValidations } = require('../middlewares/eventValidation');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
// File upload middleware removed - not currently used

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getAllEvents);
router.get('/related', getRelatedEvents);

// Get current user's events - must be before /:id route
router.get('/my', authenticateToken, requireAuth, async (req, res) => {
  try {
    const Event = require('../models/event');
    const events = await Event.find({ organizer: req.user._id })
      .sort({ createdAt: -1 })
      .populate('category');
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your events'
    });
  }
});

router.get('/:id', optionalAuth, commonValidations.mongoId('id'), handleValidationErrors, getEventById);

// Protected routes
router.post('/create', 
  authenticateToken, 
  requireAuth, 
  eventValidations.create,
  handleValidationErrors,
  createEvent
);

router.put('/:id', 
  authenticateToken, 
  requireAuth, 
  requireEventOwnership,
  commonValidations.mongoId('id'),
  eventValidations.update,
  handleValidationErrors,
  updateEvent
);

router.delete('/:id', 
  authenticateToken, 
  requireAuth, 
  requireEventOwnership,
  commonValidations.mongoId('id'),
  handleValidationErrors,
  deleteEvent
);

router.get('/user/:id', 
  authenticateToken, 
  requireAuth, 
  commonValidations.mongoId('id'),
  handleValidationErrors,
  getEventsByUser
);

// Event registration routes
router.post('/:eventId/register', 
  authenticateToken, 
  requireAuth, 
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  registerForEvent
);
router.delete('/:eventId/unregister', authenticateToken, requireAuth, unregisterFromEvent);

module.exports = router;