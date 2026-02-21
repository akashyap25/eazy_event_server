const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const smsService = require('../services/smsService');
const Event = require('../models/event');
const { User } = require('../models/user');
const { Order } = require('../models/order');

const router = express.Router();

// Send SMS to a single number
router.post('/send',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and message are required'
        });
      }

      if (!smsService.validatePhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format'
        });
      }

      const result = await smsService.sendSMS(phoneNumber, message);

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

// Send bulk SMS
router.post('/send-bulk',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { phoneNumbers, message } = req.body;

      if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Phone numbers array is required'
        });
      }

      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Message is required'
        });
      }

      // Validate all phone numbers
      const invalidNumbers = phoneNumbers.filter(num => !smsService.validatePhoneNumber(num));
      if (invalidNumbers.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid phone numbers: ${invalidNumbers.join(', ')}`
        });
      }

      const result = await smsService.sendBulkSMS(phoneNumbers, message);

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

// Send event registration SMS
router.post('/event-registration',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { eventId, userId } = req.body;

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

      if (!user.phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'User phone number not found'
        });
      }

      const result = await smsService.sendEventRegistrationSMS(
        user.phoneNumber,
        event,
        user
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

// Send event reminder SMS
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

      if (!user.phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'User phone number not found'
        });
      }

      const result = await smsService.sendEventReminderSMS(
        user.phoneNumber,
        event,
        reminderType
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

// Send event cancellation SMS to all attendees
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

      // Get all registered users with phone numbers
      const orders = await Order.find({
        eventId,
        status: 'confirmed'
      }).populate('userId');

      const usersWithPhone = orders
        .filter(order => order.userId.phoneNumber)
        .map(order => order.userId);

      if (usersWithPhone.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No users with phone numbers found',
            totalSent: 0,
            totalFailed: 0,
            results: []
          }
        });
      }

      const results = [];

      for (const user of usersWithPhone) {
        try {
          const result = await smsService.sendEventCancellationSMS(
            user.phoneNumber,
            event,
            reason
          );
          results.push({ userId: user._id, success: true, result });
        } catch (error) {
          results.push({ userId: user._id, success: false, error: error.message });
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

// Send event update SMS to all attendees
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

      // Get all registered users with phone numbers
      const orders = await Order.find({
        eventId,
        status: 'confirmed'
      }).populate('userId');

      const usersWithPhone = orders
        .filter(order => order.userId.phoneNumber)
        .map(order => order.userId);

      if (usersWithPhone.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No users with phone numbers found',
            totalSent: 0,
            totalFailed: 0,
            results: []
          }
        });
      }

      const results = [];

      for (const user of usersWithPhone) {
        try {
          const result = await smsService.sendEventUpdateSMS(
            user.phoneNumber,
            event,
            updates
          );
          results.push({ userId: user._id, success: true, result });
        } catch (error) {
          results.push({ userId: user._id, success: false, error: error.message });
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

// Send password reset SMS
router.post('/password-reset',
  async (req, res) => {
    try {
      const { phoneNumber, resetCode } = req.body;

      if (!phoneNumber || !resetCode) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and reset code are required'
        });
      }

      if (!smsService.validatePhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format'
        });
      }

      const result = await smsService.sendPasswordResetSMS(phoneNumber, resetCode);

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

// Send verification code SMS
router.post('/verification-code',
  async (req, res) => {
    try {
      const { phoneNumber, verificationCode } = req.body;

      if (!phoneNumber || !verificationCode) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and verification code are required'
        });
      }

      if (!smsService.validatePhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format'
        });
      }

      const result = await smsService.sendVerificationCodeSMS(phoneNumber, verificationCode);

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

// Send chat notification SMS
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
        if (recipient && recipient.phoneNumber) {
          try {
            const result = await smsService.sendChatNotificationSMS(
              recipient.phoneNumber,
              `${sender.firstName} ${sender.lastName}`,
              event.title,
              message
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

// Get SMS status
router.get('/status/:messageId',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { messageId } = req.params;

      const result = await smsService.getSMSStatus(messageId);

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

// Get account balance
router.get('/balance',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const result = await smsService.getAccountBalance();

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

// Get usage statistics
router.get('/usage',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const result = await smsService.getUsageStatistics({
        startDate,
        endDate
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

// Test SMS service
router.post('/test',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      if (!smsService.validatePhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format'
        });
      }

      const result = await smsService.testSMS(phoneNumber);

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

// Validate phone number
router.post('/validate',
  async (req, res) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const isValid = smsService.validatePhoneNumber(phoneNumber);
      const formatted = isValid ? smsService.formatPhoneNumber(phoneNumber) : null;

      res.json({
        success: true,
        data: {
          isValid,
          formatted,
          original: phoneNumber
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

module.exports = router;