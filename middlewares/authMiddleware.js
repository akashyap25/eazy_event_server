const { authenticateToken, optionalAuth } = require('./customAuth');

// Custom authentication middleware for protected routes
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
};

// Authorization middleware for event operations
const requireEventOwnership = async (req, res, next) => {
  try {
    const Event = require('../models/event');
    const eventId = req.params.id;
    const userId = req.user._id.toString();

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is the organizer
    if (event.organizer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only modify your own events.'
      });
    }

    req.event = event;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking event ownership'
    });
  }
};

module.exports = {
  authenticateToken,
  requireAuth,
  requireEventOwnership,
  optionalAuth
};
