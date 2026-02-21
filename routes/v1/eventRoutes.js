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
} = require('../../controllers/eventController');
const { authenticateToken, requireAuth, requireEventOwnership, optionalAuth } = require('../../middlewares/authMiddleware');
const { eventValidations } = require('../../middlewares/eventValidation');
const { handleValidationErrors, commonValidations } = require('../../utils/validationUtils');

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getAllEvents);
router.get('/related', getRelatedEvents);
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

router.delete('/:eventId/unregister', 
  authenticateToken, 
  requireAuth, 
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  unregisterFromEvent
);

module.exports = router;