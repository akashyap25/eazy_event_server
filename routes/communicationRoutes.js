/**
 * Unified Communication Routes
 * Industry-standard API endpoints for all communication types
 */

const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const notificationService = require('../services/notificationService');
const communicationConfig = require('../config/communicationConfig');
const Event = require('../models/event');
const { User } = require('../models/user');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const validateNotificationRequest = [
  body('channels').isArray().withMessage('Channels must be an array'),
  body('channels.*').isIn(['email', 'sms', 'push']).withMessage('Invalid channel type'),
  body('recipients').isArray().withMessage('Recipients must be an array'),
  body('recipients.*').isEmail().withMessage('Invalid email format'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('message').notEmpty().withMessage('Message is required'),
  handleValidationErrors
];

const validateEventNotificationRequest = [
  body('type').isIn(['event_created', 'event_updated', 'event_cancelled', 'event_reminder']).withMessage('Invalid notification type'),
  body('data').optional().isObject().withMessage('Data must be an object'),
  handleValidationErrors
];

// Get communication service status
router.get('/status', (req, res) => {
  try {
    const status = communicationConfig.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Send notification via multiple channels
router.post('/send',
  authenticateToken,
  requireAuth,
  validateNotificationRequest,
  async (req, res) => {
    try {
      const { channels, recipients, subject, message, template, data } = req.body;

      const result = await notificationService.sendNotification({
        channels,
        recipients,
        subject,
        message,
        template,
        data
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send event-specific notification
router.post('/events/:eventId/notify',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  validateEventNotificationRequest,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { type, data } = req.body;

      // Check if user is event organizer or admin
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only event organizer can send notifications.'
        });
      }

      const result = await notificationService.sendEventNotification(eventId, type, data);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send bulk notifications to event attendees
router.post('/events/:eventId/attendees/notify',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  [
    body('channels').isArray().withMessage('Channels must be an array'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { channels, subject, message, template, data } = req.body;

      // Check if user is event organizer or admin
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only event organizer can send notifications.'
        });
      }

      // Get event attendees
      const attendees = await getEventAttendees(eventId);
      
      if (attendees.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No attendees found for this event',
            totalSent: 0,
            totalFailed: 0
          }
        });
      }

      const result = await notificationService.sendNotification({
        channels,
        recipients: attendees,
        subject,
        message,
        template,
        data: { ...data, event }
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send test notification
router.post('/test',
  authenticateToken,
  requireAuth,
  [
    body('channel').isIn(['email', 'sms']).withMessage('Invalid channel type'),
    body('recipient').isEmail().withMessage('Invalid email format'),
    body('message').notEmpty().withMessage('Message is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { channel, recipient, message } = req.body;

      const result = await notificationService.sendNotification({
        channels: [channel],
        recipients: [recipient],
        subject: 'Test Notification - Eazy Event',
        message
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Helper function to get event attendees
async function getEventAttendees(eventId) {
  try {
    // This would query your database for event attendees
    // Implementation depends on your data model
    const event = await Event.findById(eventId).populate('attendees');
    return event.attendees.map(attendee => attendee.email).filter(Boolean);
  } catch (error) {
    console.error('Error getting event attendees:', error);
    return [];
  }
}

module.exports = router;