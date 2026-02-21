const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const emailTemplateService = require('../services/emailTemplateService');
const Event = require('../models/event');
const { User } = require('../models/user');
const { Order } = require('../models/order');

const router = express.Router();

// Send event registration confirmation email
router.post('/event-registration',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { eventId, userId, orderId } = req.body;

      if (!eventId || !userId || !orderId) {
        return res.status(400).json({
          success: false,
          message: 'Event ID, User ID, and Order ID are required'
        });
      }

      const event = await Event.findById(eventId);
      const user = await User.findById(userId);
      const order = await Order.findById(orderId);

      if (!event || !user || !order) {
        return res.status(404).json({
          success: false,
          message: 'Event, user, or order not found'
        });
      }

      const html = emailTemplateService.generateEventRegistrationEmail({
        event,
        user,
        order
      });

      const result = await emailTemplateService.sendEmail(
        user.email,
        `Registration Confirmed - ${event.title}`,
        html
      );

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

// Send event reminder email
router.post('/event-reminder',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { eventId, userId, reminderType = '24h' } = req.body;

      if (!eventId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Event ID and User ID are required'
        });
      }

      const event = await Event.findById(eventId);
      const user = await User.findById(userId);

      if (!event || !user) {
        return res.status(404).json({
          success: false,
          message: 'Event or user not found'
        });
      }

      const html = emailTemplateService.generateEventReminderEmail({
        event,
        user,
        reminderType
      });

      const result = await emailTemplateService.sendEmail(
        user.email,
        `Event Reminder - ${event.title}`,
        html
      );

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

// Send event cancellation email
router.post('/event-cancellation',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { eventId, reason } = req.body;

      if (!eventId) {
        return res.status(400).json({
          success: false,
          message: 'Event ID is required'
        });
      }

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Check if user is event organizer
      if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only event organizer can cancel events.'
        });
      }

      // Get all registered users
      const orders = await Order.find({
        eventId,
        status: 'confirmed'
      }).populate('userId');

      const results = [];

      for (const order of orders) {
        const html = emailTemplateService.generateEventCancellationEmail({
          event,
          user: order.userId,
          reason
        });

        try {
          const result = await emailTemplateService.sendEmail(
            order.userId.email,
            `Event Cancelled - ${event.title}`,
            html
          );
          results.push({ userId: order.userId._id, success: true, result });
        } catch (error) {
          results.push({ userId: order.userId._id, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        data: {
          totalSent: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length,
          results
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send event update email
router.post('/event-update',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { eventId, updates } = req.body;

      if (!eventId || !updates || !Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          message: 'Event ID and updates array are required'
        });
      }

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Check if user is event organizer
      if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only event organizer can send updates.'
        });
      }

      // Get all registered users
      const orders = await Order.find({
        eventId,
        status: 'confirmed'
      }).populate('userId');

      const results = [];

      for (const order of orders) {
        const html = emailTemplateService.generateEventUpdateEmail({
          event,
          user: order.userId,
          updates
        });

        try {
          const result = await emailTemplateService.sendEmail(
            order.userId.email,
            `Event Updated - ${event.title}`,
            html
          );
          results.push({ userId: order.userId._id, success: true, result });
        } catch (error) {
          results.push({ userId: order.userId._id, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        data: {
          totalSent: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length,
          results
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send password reset email
router.post('/password-reset',
  async (req, res) => {
    try {
      const { email, resetToken } = req.body;

      if (!email || !resetToken) {
        return res.status(400).json({
          success: false,
          message: 'Email and reset token are required'
        });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const html = emailTemplateService.generatePasswordResetEmail({
        user,
        resetToken
      });

      const result = await emailTemplateService.sendEmail(
        user.email,
        'Password Reset - Eazy Event',
        html
      );

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

// Send email verification email
router.post('/email-verification',
  async (req, res) => {
    try {
      const { email, verificationToken } = req.body;

      if (!email || !verificationToken) {
        return res.status(400).json({
          success: false,
          message: 'Email and verification token are required'
        });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const html = emailTemplateService.generateEmailVerificationEmail({
        user,
        verificationToken
      });

      const result = await emailTemplateService.sendEmail(
        user.email,
        'Verify Your Email - Eazy Event',
        html
      );

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

// Send chat notification email
router.post('/chat-notification',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { eventId, senderId, message, recipientIds } = req.body;

      if (!eventId || !senderId || !message || !recipientIds || !Array.isArray(recipientIds)) {
        return res.status(400).json({
          success: false,
          message: 'Event ID, sender ID, message, and recipient IDs are required'
        });
      }

      const event = await Event.findById(eventId);
      const sender = await User.findById(senderId);

      if (!event || !sender) {
        return res.status(404).json({
          success: false,
          message: 'Event or sender not found'
        });
      }

      const results = [];

      for (const recipientId of recipientIds) {
        const recipient = await User.findById(recipientId);
        if (recipient) {
          const html = emailTemplateService.generateChatNotificationEmail({
            event,
            sender,
            message,
            recipient
          });

          try {
            const result = await emailTemplateService.sendEmail(
              recipient.email,
              `New Chat Message - ${event.title}`,
              html
            );
            results.push({ recipientId, success: true, result });
          } catch (error) {
            results.push({ recipientId, success: false, error: error.message });
          }
        }
      }

      res.json({
        success: true,
        data: {
          totalSent: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length,
          results
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Test email template
router.post('/test-template',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { templateType, data } = req.body;

      if (!templateType) {
        return res.status(400).json({
          success: false,
          message: 'Template type is required'
        });
      }

      let html;
      let subject;

      switch (templateType) {
        case 'registration':
          html = emailTemplateService.generateEventRegistrationEmail(data);
          subject = 'Test - Registration Confirmed';
          break;
        case 'reminder':
          html = emailTemplateService.generateEventReminderEmail(data);
          subject = 'Test - Event Reminder';
          break;
        case 'cancellation':
          html = emailTemplateService.generateEventCancellationEmail(data);
          subject = 'Test - Event Cancelled';
          break;
        case 'update':
          html = emailTemplateService.generateEventUpdateEmail(data);
          subject = 'Test - Event Updated';
          break;
        case 'password-reset':
          html = emailTemplateService.generatePasswordResetEmail(data);
          subject = 'Test - Password Reset';
          break;
        case 'email-verification':
          html = emailTemplateService.generateEmailVerificationEmail(data);
          subject = 'Test - Email Verification';
          break;
        case 'chat-notification':
          html = emailTemplateService.generateChatNotificationEmail(data);
          subject = 'Test - Chat Notification';
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid template type'
          });
      }

      const result = await emailTemplateService.sendEmail(
        req.user.email,
        subject,
        html
      );

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

module.exports = router;